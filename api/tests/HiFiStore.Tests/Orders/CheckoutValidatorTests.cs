using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Orders;

namespace HiFiStore.Tests.Orders;

public class CheckoutValidatorTests
{
    private static readonly Guid ProductA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ProductB = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Theory]
    [InlineData("+380 (67) 123-45-67", "+380671234567")]
    [InlineData("+7.912.345.67.89", "+79123456789")]
    [InlineData("+48 512 345 678", "+48512345678")]
    [InlineData("+1 (212) 555-0123", "+12125550123")]
    public void NormalizePhone_ReturnsE164(string raw, string expected) =>
        Assert.Equal(expected, CheckoutValidator.NormalizePhone(raw));

    [Theory]
    // Без кода страны номер неоднозначен: страну магазин не угадывает.
    [InlineData("067 123 45 67")]
    // Длина не подходит для Украины (на цифру короче и длиннее).
    [InlineData("+380 67 123 45 6")]
    [InlineData("+380 67 123 45 678")]
    [InlineData("12345")]
    [InlineData("+380 67 123 45 67 89 01 23")]
    [InlineData("phone")]
    [InlineData("380+671234567")]
    [InlineData("")]
    public void NormalizePhone_RejectsInvalid(string raw) =>
        Assert.Null(CheckoutValidator.NormalizePhone(raw));

    [Fact]
    public void ValidRequest_IsNormalized()
    {
        var ok = CheckoutValidator.TryValidate(
            Valid() with { FullName = "  Иван Петров ", Email = " ivan@example.com ", Comment = "   " },
            out var checkout,
            out var errors);

        Assert.True(ok, string.Join("; ", errors.Keys));
        Assert.NotNull(checkout);
        Assert.Equal("Иван Петров", checkout.FullName);
        Assert.Equal("ivan@example.com", checkout.Email);
        Assert.Equal("+380671234567", checkout.Phone);
        Assert.Equal(DeliveryMethod.NovaPoshtaWarehouse, checkout.DeliveryMethod);
        Assert.Equal(PaymentMethod.CashOnDelivery, checkout.PaymentMethod);
        Assert.Null(checkout.Comment);
        Assert.Null(checkout.Address);
    }

    [Fact]
    public void EnumNames_AreCaseInsensitive_ButNumbersAreRejected()
    {
        Assert.True(CheckoutValidator.TryValidate(
            Valid() with { DeliveryMethod = "pickup", PaymentMethod = "banktransfer" }, out _, out _));

        Assert.False(CheckoutValidator.TryValidate(
            Valid() with { DeliveryMethod = "2", PaymentMethod = "1" }, out _, out var errors));
        Assert.Contains("deliveryMethod", errors.Keys);
        Assert.Contains("paymentMethod", errors.Keys);
    }

    [Fact]
    public void WarehouseDelivery_RequiresCityAndWarehouse()
    {
        var ok = CheckoutValidator.TryValidate(
            Valid() with { City = " ", Warehouse = null }, out _, out var errors);

        Assert.False(ok);
        Assert.Equal(["Укажите город."], errors["city"]);
        Assert.Contains("warehouse", errors.Keys);
        Assert.DoesNotContain("address", errors.Keys);
    }

    [Fact]
    public void CourierDelivery_RequiresAddress_AndDropsWarehouse()
    {
        Assert.False(CheckoutValidator.TryValidate(
            Valid() with { DeliveryMethod = "NovaPoshtaCourier" }, out _, out var errors));
        Assert.Equal(["address"], errors.Keys);

        Assert.True(CheckoutValidator.TryValidate(
            Valid() with { DeliveryMethod = "NovaPoshtaCourier", Address = "ул. Крещатик, 1, кв. 5" },
            out var checkout,
            out _));
        Assert.Null(checkout!.Warehouse);
        Assert.Null(checkout.WarehouseRef);
        Assert.Equal("Киев", checkout.City);
    }

    [Fact]
    public void Pickup_NeedsNoAddress_AndDropsDeliveryFields()
    {
        var ok = CheckoutValidator.TryValidate(
            Valid() with { DeliveryMethod = "Pickup", CityRef = "abc" }, out var checkout, out var errors);

        Assert.True(ok, string.Join("; ", errors.Keys));
        Assert.Null(checkout!.City);
        Assert.Null(checkout.CityRef);
        Assert.Null(checkout.Warehouse);
    }

    [Fact]
    public void Lines_DuplicatesAreMerged_AndQuantityIsBounded()
    {
        var errors = new Dictionary<string, string[]>();
        var lines = CheckoutValidator.ValidateLines(
            [new(ProductA, 1), new(ProductB, 2), new(ProductA, 3), new(ProductB, 0), new(Guid.Empty, 1)],
            errors);

        Assert.Equal([new CartLine(0, ProductA, 4), new CartLine(1, ProductB, 2)], lines);
        Assert.Contains("items[3].quantity", errors.Keys);
        Assert.Contains("items[4].productId", errors.Keys);
    }

    [Fact]
    public void Lines_MergedQuantityAboveLimit_IsRejected()
    {
        var errors = new Dictionary<string, string[]>();
        CheckoutValidator.ValidateLines(
            [new(ProductA, CheckoutValidator.MaxQuantity), new(ProductA, 1)], errors);

        Assert.Contains("items[1].quantity", errors.Keys);
    }

    [Fact]
    public void MissingEverything_ReportsEachField()
    {
        var ok = CheckoutValidator.TryValidate(new CheckoutRequest(), out _, out var errors);

        Assert.False(ok);
        Assert.Equal(
            ["deliveryMethod", "email", "fullName", "items", "paymentMethod", "phone"],
            errors.Keys.Order(StringComparer.Ordinal));
    }

    private static CheckoutRequest Valid() => new()
    {
        Items = [new CartItemRequest(ProductA, 1)],
        FullName = "Иван Петров",
        Phone = "+380 67 123 45 67",
        Email = "ivan@example.com",
        DeliveryMethod = "NovaPoshtaWarehouse",
        City = "Киев",
        Warehouse = "Отделение №12",
        PaymentMethod = "CashOnDelivery",
    };
}
