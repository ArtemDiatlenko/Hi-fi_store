using HiFiStore.Domain.Catalog;
using System.Text.RegularExpressions;
using HiFiStore.Domain.Orders;

namespace HiFiStore.Infrastructure.Orders;

/// <summary>
/// Проверка данных корзины и оформления заказа без обращения к БД. Ключи ошибок совпадают
/// с именами полей JSON (<c>fullName</c>, <c>items[0].quantity</c> и т. д.), чтобы витрина
/// могла показать сообщение рядом с полем.
/// </summary>
public static partial class CheckoutValidator
{
    public const int MaxLines = 50;
    public const int MaxQuantity = 99;

    private const int MaxNameLength = 200;
    private const int MaxEmailLength = 254;
    private const int MaxCityLength = 200;
    private const int MaxWarehouseLength = 300;
    private const int MaxAddressLength = 500;
    private const int MaxRefLength = 64;
    private const int MaxCommentLength = 1000;

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();

    /// <summary>Проверяет строки корзины: непустой список, корректные товары и количество. Дубликаты объединяются.</summary>
    public static List<CartLine> ValidateLines(IReadOnlyList<CartItemRequest>? items, Dictionary<string, string[]> errors)
    {
        var lines = new List<CartLine>();
        if (items is null || items.Count == 0)
        {
            AddError(errors, "items", "Корзина пуста.");
            return lines;
        }

        if (items.Count > MaxLines)
        {
            AddError(errors, "items", $"В заказе может быть не больше {MaxLines} позиций.");
            return lines;
        }

        var byProduct = new Dictionary<Guid, CartLine>();
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            if (item is null || item.ProductId == Guid.Empty)
            {
                AddError(errors, $"items[{i}].productId", "Не указан товар.");
                continue;
            }

            if (item.Quantity is < 1 or > MaxQuantity)
            {
                AddError(errors, $"items[{i}].quantity", $"Количество должно быть от 1 до {MaxQuantity}.");
                continue;
            }

            if (byProduct.TryGetValue(item.ProductId, out var existing))
            {
                var merged = existing.Quantity + item.Quantity;
                if (merged > MaxQuantity)
                {
                    AddError(errors, $"items[{i}].quantity", $"Количество должно быть от 1 до {MaxQuantity}.");
                    continue;
                }

                byProduct[item.ProductId] = existing with { Quantity = merged };
            }
            else
            {
                byProduct[item.ProductId] = new CartLine(i, item.ProductId, item.Quantity);
            }
        }

        lines.AddRange(byProduct.Values.OrderBy(l => l.Index));
        return lines;
    }

    public static bool TryValidate(
        CheckoutRequest? request,
        out ValidatedCheckout? checkout,
        out Dictionary<string, string[]> errors)
    {
        errors = [];
        checkout = null;

        if (request is null)
        {
            AddError(errors, "items", "Корзина пуста.");
            return false;
        }

        var lines = ValidateLines(request.Items, errors);

        var fullName = Clean(request.FullName);
        if (fullName is null)
        {
            AddError(errors, "fullName", "Укажите имя и фамилию.");
        }
        else if (fullName.Length < 2 || fullName.Length > MaxNameLength)
        {
            AddError(errors, "fullName", $"Имя должно содержать от 2 до {MaxNameLength} символов.");
        }

        var phone = NormalizePhone(request.Phone);
        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            AddError(errors, "phone", "Укажите телефон.");
        }
        else if (phone is null)
        {
            AddError(errors, "phone", Phones.InvalidMessage);
        }

        var email = Clean(request.Email);
        if (email is null)
        {
            AddError(errors, "email", "Укажите email.");
        }
        else if (email.Length > MaxEmailLength || !EmailPattern().IsMatch(email))
        {
            AddError(errors, "email", "Некорректный email.");
        }

        DeliveryMethod? delivery = null;
        if (EnumNames.TryParse<DeliveryMethod>(request.DeliveryMethod, out var parsedDelivery))
        {
            delivery = parsedDelivery;
        }
        else
        {
            AddError(errors, "deliveryMethod", "Выберите способ доставки.");
        }

        PaymentMethod? payment = null;
        if (EnumNames.TryParse<PaymentMethod>(request.PaymentMethod, out var parsedPayment))
        {
            payment = parsedPayment;
        }
        else
        {
            AddError(errors, "paymentMethod", "Выберите способ оплаты.");
        }

        // Поля адреса нужны в зависимости от способа доставки; лишние отбрасываются.
        var needsCity = delivery is DeliveryMethod.NovaPoshtaWarehouse or DeliveryMethod.NovaPoshtaCourier;
        var city = needsCity ? Clean(request.City) : null;
        var cityRef = needsCity ? Clean(request.CityRef) : null;
        var warehouse = delivery == DeliveryMethod.NovaPoshtaWarehouse ? Clean(request.Warehouse) : null;
        var warehouseRef = delivery == DeliveryMethod.NovaPoshtaWarehouse ? Clean(request.WarehouseRef) : null;
        var address = delivery == DeliveryMethod.NovaPoshtaCourier ? Clean(request.Address) : null;

        if (needsCity)
        {
            RequireText(errors, "city", city, MaxCityLength, "Укажите город.");
            CheckLength(errors, "cityRef", cityRef, MaxRefLength);
        }

        if (delivery == DeliveryMethod.NovaPoshtaWarehouse)
        {
            RequireText(errors, "warehouse", warehouse, MaxWarehouseLength, "Укажите отделение или почтомат Новой почты.");
            CheckLength(errors, "warehouseRef", warehouseRef, MaxRefLength);
        }

        if (delivery == DeliveryMethod.NovaPoshtaCourier)
        {
            RequireText(errors, "address", address, MaxAddressLength, "Укажите адрес доставки: улицу, дом и квартиру.");
        }

        var comment = Clean(request.Comment);
        CheckLength(errors, "comment", comment, MaxCommentLength);

        if (errors.Count > 0)
        {
            return false;
        }

        checkout = new ValidatedCheckout(
            lines,
            fullName!,
            phone!,
            email!,
            delivery!.Value,
            city,
            cityRef,
            warehouse,
            warehouseRef,
            address,
            payment!.Value,
            comment,
            ContentLocales.Resolve(request.Locale));
        return true;
    }

    /// <summary>
    /// Номер в формате E.164 (<c>+380671234567</c>) или <c>null</c>, если номер некорректен (см. <see cref="Phones"/>).
    /// </summary>
    public static string? NormalizePhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        return Phones.Normalize(raw);
    }

    private static void RequireText(
        Dictionary<string, string[]> errors, string field, string? value, int maxLength, string requiredMessage)
    {
        if (value is null)
        {
            AddError(errors, field, requiredMessage);
            return;
        }

        CheckLength(errors, field, value, maxLength);
    }

    private static void CheckLength(Dictionary<string, string[]> errors, string field, string? value, int maxLength)
    {
        if (value is not null && value.Length > maxLength)
        {
            AddError(errors, field, $"Не больше {maxLength} символов.");
        }
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    internal static void AddError(Dictionary<string, string[]> errors, string name, string message)
    {
        errors[name] = errors.TryGetValue(name, out var existing)
            ? [.. existing, message]
            : [message];
    }
}
