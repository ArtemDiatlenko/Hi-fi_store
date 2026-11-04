using HiFiStore.Domain.Catalog;
using System.Globalization;
using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Orders;

public sealed class OrderService(StoreDbContext db) : IOrderService
{
    public async Task<CartQuote> QuoteAsync(IReadOnlyList<CartLine> lines, string locale = ContentLocales.Base, CancellationToken ct = default)
    {
        var ids = lines.Select(l => l.ProductId).ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.IsPublished)
            .Select(p => new
            {
                p.Id,
                p.Sku,
                Name = p.Translations.Where(t => t.Locale == locale).Select(t => t.Name).FirstOrDefault() ?? p.Name,
                p.Slug,
                p.Price,
                p.OldPrice,
                p.Stock,
                ImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
            })
            .ToDictionaryAsync(p => p.Id, ct);

        var quoted = lines
            .Select(line =>
            {
                if (!products.TryGetValue(line.ProductId, out var p))
                {
                    return new CartQuoteLine(
                        line.ProductId, null, null, null, null, null, null, line.Quantity, 0m, 0, CartLineStatus.Unavailable);
                }

                var status = line.Quantity <= p.Stock ? CartLineStatus.Ok : CartLineStatus.InsufficientStock;
                return new CartQuoteLine(
                    p.Id, p.Sku, p.Name, p.Slug, p.ImageUrl, p.Price, p.OldPrice,
                    line.Quantity, p.Price * line.Quantity, Math.Max(p.Stock, 0), status);
            })
            .ToList();

        return new CartQuote(
            quoted,
            quoted.Where(l => l.Status != CartLineStatus.Unavailable).Sum(l => l.Quantity),
            quoted.Sum(l => l.LineTotal),
            quoted.Count > 0 && quoted.All(l => l.Status == CartLineStatus.Ok));
    }

    public async Task<PlaceOrderResult> PlaceOrderAsync(
        ValidatedCheckout checkout, Guid? userId, CancellationToken ct = default)
    {
        var lines = checkout.Lines;
        var ids = lines.Select(l => l.ProductId).ToList();

        // 1. Быстрые проверки без транзакции: товары существуют и опубликованы, остатков на вид хватает.
        var current = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.IsPublished)
            .Select(p => new { p.Id, p.Name, p.Stock })
            .ToDictionaryAsync(p => p.Id, ct);

        var errors = new Dictionary<string, string[]>();
        foreach (var line in lines.Where(l => !current.ContainsKey(l.ProductId)))
        {
            CheckoutValidator.AddError(errors, $"items[{line.Index}].productId", "Товар не найден или снят с продажи.");
        }

        if (errors.Count > 0)
        {
            return new PlaceOrderResult.Invalid(errors);
        }

        var shortages = lines
            .Where(l => current[l.ProductId].Stock < l.Quantity)
            .Select(l => new StockShortage(l.ProductId, current[l.ProductId].Name, l.Quantity, Math.Max(current[l.ProductId].Stock, 0)))
            .ToList();
        if (shortages.Count > 0)
        {
            return new PlaceOrderResult.OutOfStock(shortages);
        }

        // 2. Списание остатков. Условный UPDATE ... WHERE "Stock" >= @qty блокирует строку товара:
        // параллельная транзакция ждёт и после нашего COMMIT перепроверяет условие уже на новом остатке,
        // поэтому продать больше, чем есть, нельзя. Строки блокируются в порядке Id — без взаимоблокировок.
        var now = DateTimeOffset.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var failed = new List<CartLine>();
        foreach (var line in lines.OrderBy(l => l.ProductId))
        {
            var productId = line.ProductId;
            var quantity = line.Quantity;
            var updated = await db.Products
                .Where(p => p.Id == productId && p.IsPublished && p.Stock >= quantity)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(p => p.Stock, p => p.Stock - quantity).SetProperty(p => p.UpdatedAt, now),
                    ct);

            if (updated == 0)
            {
                failed.Add(line);
            }
        }

        if (failed.Count > 0)
        {
            await transaction.RollbackAsync(ct);
            return new PlaceOrderResult.OutOfStock(await DescribeShortagesAsync(failed, ct));
        }

        // Строки товаров заблокированы нашей транзакцией, так что цена и название читаются согласованно со списанием.
        var snapshot = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Sku, p.Name, p.Price })
            .ToDictionaryAsync(p => p.Id, ct);

        var (token, tokenHash) = OrderTokens.Create();
        var order = new Order
        {
            Id = Guid.CreateVersion7(),
            PublicTokenHash = tokenHash,
            Status = OrderStatus.New,
            UserId = userId,
            Locale = checkout.Locale,
            CustomerName = checkout.FullName,
            CustomerPhone = checkout.Phone,
            CustomerEmail = checkout.Email,
            DeliveryMethod = checkout.DeliveryMethod,
            DeliveryCity = checkout.City,
            DeliveryCityRef = checkout.CityRef,
            DeliveryWarehouse = checkout.Warehouse,
            DeliveryWarehouseRef = checkout.WarehouseRef,
            DeliveryAddress = checkout.Address,
            PaymentMethod = checkout.PaymentMethod,
            CustomerComment = checkout.Comment,
            CreatedAt = now,
            UpdatedAt = now,
            Items = lines
                .Select(line =>
                {
                    var product = snapshot[line.ProductId];
                    return new OrderItem
                    {
                        Id = Guid.CreateVersion7(),
                        ProductId = product.Id,
                        Sku = product.Sku,
                        Name = product.Name,
                        UnitPrice = product.Price,
                        Quantity = line.Quantity,
                        LineTotal = product.Price * line.Quantity,
                    };
                })
                .ToList(),
        };
        order.Total = order.Items.Sum(i => i.LineTotal);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        // Покупателю (ответ и письмо) — названия на его языке; в заказе остаётся снимок на основном.
        return new PlaceOrderResult.Placed(new CheckoutResponse(token, await LocalizeItemsAsync(ToDetails(order), checkout.Locale, ct)));
    }

    public async Task<OrderDetails?> GetByTokenAsync(string token, string locale = ContentLocales.Base, CancellationToken ct = default)
    {
        if (!OrderTokens.IsWellFormed(token))
        {
            return null;
        }

        var hash = OrderTokens.Hash(token);
        var order = await LoadAsync(db.Orders.Where(o => o.PublicTokenHash == hash), ct);
        return order is null ? null : await LocalizeItemsAsync(ToDetails(order), locale, ct);
    }

    public async Task<PagedResult<OrderSummary>> ListForUserAsync(
        Guid userId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = db.Orders.AsNoTracking().Where(o => o.UserId == userId);
        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Number)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderSummary(o.Id, o.Number, o.Status, o.Items.Sum(i => i.Quantity), o.Total, o.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<OrderSummary>(items, page, pageSize, total);
    }

    public async Task<OrderDetails?> GetForUserAsync(
        Guid userId, Guid orderId, string locale = ContentLocales.Base, CancellationToken ct = default)
    {
        var order = await LoadAsync(db.Orders.Where(o => o.Id == orderId && o.UserId == userId), ct);
        return order is null ? null : await LocalizeItemsAsync(ToDetails(order), locale, ct);
    }

    /// <summary>
    /// В заказе хранится снимок названий на основном языке (так их видит менеджер). Покупателю на другом языке
    /// показываем текущий перевод товара, если он есть.
    /// </summary>
    private async Task<OrderDetails> LocalizeItemsAsync(OrderDetails order, string locale, CancellationToken ct)
    {
        if (locale == ContentLocales.Base)
        {
            return order;
        }

        var ids = order.Items.Select(i => i.ProductId).ToList();
        var names = await db.ProductTranslations.AsNoTracking()
            .Where(t => t.Locale == locale && ids.Contains(t.ProductId))
            .ToDictionaryAsync(t => t.ProductId, t => t.Name, ct);
        return names.Count == 0
            ? order
            : order with { Items = order.Items.Select(i => names.TryGetValue(i.ProductId, out var name) ? i with { Name = name } : i).ToList() };
    }

    public async Task<PagedResult<AdminOrderSummary>> ListForAdminAsync(AdminOrderFilter filter, CancellationToken ct = default)
    {
        IQueryable<Order> query = db.Orders.AsNoTracking();

        if (filter.Status is { } status)
        {
            query = query.Where(o => o.Status == status);
        }

        if (filter.CustomerId is { } customerId)
        {
            query = query.Where(o => o.UserId == customerId);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            var pattern = $"%{EscapeLike(term)}%";
            // «№100042» или «#100042» — номер заказа.
            long? number = long.TryParse(
                term.TrimStart('#', '№').Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : null;
            // Телефон ищется по цифрам, если строка похожа на телефон: «+380 (67) 123-45», «067 123».
            // Ведущий ноль национального формата отбрасывается, чтобы «067…» находило «+38067…».
            var digits = Phones.SearchDigits(term);
            var searchPhone = digits.Length > 0 && term.All(c => char.IsAsciiDigit(c) || c is ' ' or '+' or '-' or '(' or ')' or '.');

            query = query.Where(o =>
                (number != null && o.Number == number) ||
                (searchPhone && o.CustomerPhone.Contains(digits)) ||
                EF.Functions.ILike(o.CustomerEmail, pattern, "\\") ||
                EF.Functions.ILike(o.CustomerName, pattern, "\\"));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Number)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(o => new AdminOrderSummary(
                o.Id,
                o.Number,
                o.Status,
                o.CustomerName,
                o.CustomerPhone,
                o.CustomerEmail,
                o.UserId == null,
                o.DeliveryMethod,
                o.PaymentMethod,
                o.Items.Sum(i => i.Quantity),
                o.Total,
                o.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<AdminOrderSummary>(items, filter.Page, filter.PageSize, total);
    }

    public async Task<AdminOrderDetails?> GetForAdminAsync(Guid orderId, CancellationToken ct = default)
    {
        var order = await LoadAsync(db.Orders.Where(o => o.Id == orderId), ct);
        return order is null ? null : ToAdminDetails(order);
    }

    public async Task<ChangeStatusResult> ChangeStatusAsync(
        Guid orderId, OrderStatus status, string? trackingNumber = null, CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var current = await db.Orders.AsNoTracking()
            .Where(o => o.Id == orderId)
            .Select(o => (OrderStatus?)o.Status)
            .FirstOrDefaultAsync(ct);

        if (current is null)
        {
            return new ChangeStatusResult.NotFound();
        }

        if (!OrderWorkflow.CanTransition(current.Value, status))
        {
            return new ChangeStatusResult.NotAllowed(current.Value, status);
        }

        // Условие на прежний статус защищает от гонки: из двух одновременных отмен
        // сработает одна, вторая увидит уже новый статус и ничего не изменит.
        var now = DateTimeOffset.UtcNow;
        var expected = current.Value;
        var updated = await db.Orders
            .Where(o => o.Id == orderId && o.Status == expected)
            .ExecuteUpdateAsync(
                s => s.SetProperty(o => o.Status, status)
                    .SetProperty(o => o.UpdatedAt, now)
                    // ТТН вносится при отправке; пустое значение не стирает уже записанный номер.
                    .SetProperty(o => o.TrackingNumber, o => trackingNumber ?? o.TrackingNumber),
                ct);

        if (updated == 0)
        {
            await transaction.RollbackAsync(ct);
            var actual = await db.Orders.AsNoTracking().Where(o => o.Id == orderId).Select(o => o.Status).FirstAsync(ct);
            return new ChangeStatusResult.NotAllowed(actual, status);
        }

        if (status == OrderStatus.Cancelled)
        {
            var returned = await db.OrderItems.AsNoTracking()
                .Where(i => i.OrderId == orderId)
                .GroupBy(i => i.ProductId)
                .Select(g => new { ProductId = g.Key, Quantity = g.Sum(i => i.Quantity) })
                .ToListAsync(ct);

            foreach (var item in returned.OrderBy(i => i.ProductId))
            {
                var productId = item.ProductId;
                var quantity = item.Quantity;
                // Если товар успели удалить из каталога, вернуть некуда — строка просто не обновится.
                await db.Products
                    .Where(p => p.Id == productId)
                    .ExecuteUpdateAsync(
                        s => s.SetProperty(p => p.Stock, p => p.Stock + quantity).SetProperty(p => p.UpdatedAt, now),
                        ct);
            }
        }

        await transaction.CommitAsync(ct);

        var order = await LoadAsync(db.Orders.Where(o => o.Id == orderId), ct);
        return new ChangeStatusResult.Changed(ToAdminDetails(order!));
    }

    public async Task<UpdateAdminInfoResult?> UpdateAdminInfoAsync(
        Guid orderId, string? trackingNumber, string? managerNote, CancellationToken ct = default)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null)
        {
            return null;
        }

        var trackingChanged = order.TrackingNumber != trackingNumber;
        order.TrackingNumber = trackingNumber;
        order.ManagerNote = managerNote;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var saved = await LoadAsync(db.Orders.Where(o => o.Id == orderId), ct);
        return new UpdateAdminInfoResult(ToAdminDetails(saved!), trackingChanged);
    }

    private async Task<List<StockShortage>> DescribeShortagesAsync(List<CartLine> failed, CancellationToken ct)
    {
        var failedIds = failed.Select(l => l.ProductId).ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => failedIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.Stock, p.IsPublished })
            .ToDictionaryAsync(p => p.Id, ct);

        return failed
            .OrderBy(l => l.Index)
            .Select(l => products.TryGetValue(l.ProductId, out var p)
                ? new StockShortage(l.ProductId, p.Name, l.Quantity, p.IsPublished ? Math.Max(p.Stock, 0) : 0)
                : new StockShortage(l.ProductId, string.Empty, l.Quantity, 0))
            .ToList();
    }

    private static Task<Order?> LoadAsync(IQueryable<Order> query, CancellationToken ct) =>
        query.AsNoTracking().Include(o => o.Items).FirstOrDefaultAsync(ct);

    private static OrderDetails ToDetails(Order order) => new(
        order.Id,
        order.Number,
        order.Status,
        ToCustomer(order),
        ToDelivery(order),
        order.PaymentMethod,
        order.CustomerComment,
        ToItems(order),
        order.Total,
        order.CreatedAt,
        order.UpdatedAt,
        order.TrackingNumber,
        order.Locale);

    private static AdminOrderDetails ToAdminDetails(Order order) => new(
        order.Id,
        order.Number,
        order.Status,
        OrderWorkflow.NextStatuses(order.Status),
        order.UserId,
        ToCustomer(order),
        ToDelivery(order),
        order.PaymentMethod,
        order.CustomerComment,
        ToItems(order),
        order.Total,
        order.CreatedAt,
        order.UpdatedAt,
        order.TrackingNumber,
        order.ManagerNote,
        order.Locale);

    private static OrderCustomerDto ToCustomer(Order order) =>
        new(order.CustomerName, order.CustomerPhone, order.CustomerEmail);

    private static OrderDeliveryDto ToDelivery(Order order) => new(
        order.DeliveryMethod,
        order.DeliveryCity,
        order.DeliveryCityRef,
        order.DeliveryWarehouse,
        order.DeliveryWarehouseRef,
        order.DeliveryAddress);

    private static List<OrderItemDto> ToItems(Order order) => order.Items
        .OrderBy(i => i.Name, StringComparer.Ordinal)
        .Select(i => new OrderItemDto(i.ProductId, i.Sku, i.Name, i.UnitPrice, i.Quantity, i.LineTotal))
        .ToList();

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
