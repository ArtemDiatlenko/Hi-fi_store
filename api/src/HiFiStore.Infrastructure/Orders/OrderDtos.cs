using HiFiStore.Domain.Orders;

namespace HiFiStore.Infrastructure.Orders;

// ---- Запросы ----

/// <summary>Строка корзины, как её присылает витрина: только товар и количество, без цен.</summary>
public sealed record CartItemRequest(Guid ProductId, int Quantity);

public sealed record CartQuoteRequest(IReadOnlyList<CartItemRequest>? Items);

/// <summary>
/// Данные оформления заказа. Все поля необязательны на уровне привязки модели: проверку
/// и сообщения об ошибках делает <see cref="CheckoutValidator"/>. Цены от клиента не принимаются.
/// </summary>
public sealed record CheckoutRequest
{
    public IReadOnlyList<CartItemRequest>? Items { get; init; }

    public string? FullName { get; init; }

    public string? Phone { get; init; }

    public string? Email { get; init; }

    /// <summary><c>NovaPoshtaWarehouse</c>, <c>NovaPoshtaCourier</c> или <c>Pickup</c>.</summary>
    public string? DeliveryMethod { get; init; }

    public string? City { get; init; }

    public string? CityRef { get; init; }

    public string? Warehouse { get; init; }

    public string? WarehouseRef { get; init; }

    public string? Address { get; init; }

    /// <summary><c>CashOnDelivery</c> или <c>BankTransfer</c>.</summary>
    public string? PaymentMethod { get; init; }

    public string? Comment { get; init; }
}

/// <summary>Строка корзины после проверки: дубликаты товара объединены, <see cref="Index"/> — позиция в запросе.</summary>
public sealed record CartLine(int Index, Guid ProductId, int Quantity);

/// <summary>Проверенные и нормализованные данные заказа.</summary>
public sealed record ValidatedCheckout(
    IReadOnlyList<CartLine> Lines,
    string FullName,
    string Phone,
    string Email,
    DeliveryMethod DeliveryMethod,
    string? City,
    string? CityRef,
    string? Warehouse,
    string? WarehouseRef,
    string? Address,
    PaymentMethod PaymentMethod,
    string? Comment);

public sealed record AdminOrderFilter(OrderStatus? Status, string? Search, int Page, int PageSize);

// ---- Ответы ----

public enum CartLineStatus
{
    Ok,

    /// <summary>На складе меньше, чем в корзине (в том числе ноль).</summary>
    InsufficientStock,

    /// <summary>Товар не найден или снят с публикации.</summary>
    Unavailable,
}

/// <summary>Строка корзины с актуальными данными из каталога.</summary>
public sealed record CartQuoteLine(
    Guid ProductId,
    string? Sku,
    string? Name,
    string? Slug,
    string? ImageUrl,
    decimal? UnitPrice,
    decimal? OldPrice,
    int Quantity,
    decimal LineTotal,
    int AvailableStock,
    CartLineStatus Status);

public sealed record CartQuote(IReadOnlyList<CartQuoteLine> Items, int TotalQuantity, decimal Total, bool CanCheckout);

public sealed record OrderItemDto(Guid ProductId, string Sku, string Name, decimal UnitPrice, int Quantity, decimal LineTotal);

public sealed record OrderCustomerDto(string FullName, string Phone, string Email);

public sealed record OrderDeliveryDto(
    DeliveryMethod Method,
    string? City,
    string? CityRef,
    string? Warehouse,
    string? WarehouseRef,
    string? Address);

/// <summary>Заказ для покупателя: страница подтверждения и личный кабинет.</summary>
public sealed record OrderDetails(
    Guid Id,
    long Number,
    OrderStatus Status,
    OrderCustomerDto Customer,
    OrderDeliveryDto Delivery,
    PaymentMethod PaymentMethod,
    string? Comment,
    IReadOnlyList<OrderItemDto> Items,
    decimal Total,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>Результат оформления. <see cref="Token"/> — ключ к странице подтверждения, показывается один раз.</summary>
public sealed record CheckoutResponse(string Token, OrderDetails Order);

public sealed record OrderSummary(Guid Id, long Number, OrderStatus Status, int ItemCount, decimal Total, DateTimeOffset CreatedAt);

public sealed record AdminOrderSummary(
    Guid Id,
    long Number,
    OrderStatus Status,
    string CustomerName,
    string CustomerPhone,
    string CustomerEmail,
    bool IsGuest,
    DeliveryMethod DeliveryMethod,
    PaymentMethod PaymentMethod,
    int ItemCount,
    decimal Total,
    DateTimeOffset CreatedAt);

public sealed record AdminOrderDetails(
    Guid Id,
    long Number,
    OrderStatus Status,
    IReadOnlyList<OrderStatus> NextStatuses,
    Guid? UserId,
    OrderCustomerDto Customer,
    OrderDeliveryDto Delivery,
    PaymentMethod PaymentMethod,
    string? Comment,
    IReadOnlyList<OrderItemDto> Items,
    decimal Total,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record StockShortage(Guid ProductId, string Name, int Requested, int Available);

// ---- Результаты операций ----

public abstract record PlaceOrderResult
{
    public sealed record Placed(CheckoutResponse Response) : PlaceOrderResult;

    public sealed record Invalid(Dictionary<string, string[]> Errors) : PlaceOrderResult;

    public sealed record OutOfStock(IReadOnlyList<StockShortage> Items) : PlaceOrderResult;
}

public abstract record ChangeStatusResult
{
    public sealed record Changed(AdminOrderDetails Order) : ChangeStatusResult;

    public sealed record NotFound : ChangeStatusResult;

    public sealed record NotAllowed(OrderStatus Current, OrderStatus Requested) : ChangeStatusResult;
}
