using HiFiStore.Domain.Catalog;
using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Catalog;

namespace HiFiStore.Infrastructure.Orders;

public interface IOrderService
{
    /// <summary>Актуальные цены, наличие и сумма для строк корзины. Строки должны быть уже проверены.</summary>
    Task<CartQuote> QuoteAsync(IReadOnlyList<CartLine> lines, string locale = ContentLocales.Base, CancellationToken ct = default);

    /// <summary>
    /// Оформляет заказ: проверяет товары, атомарно списывает остатки и сохраняет снимок позиций.
    /// Цены берутся только из каталога.
    /// </summary>
    Task<PlaceOrderResult> PlaceOrderAsync(ValidatedCheckout checkout, Guid? userId, CancellationToken ct = default);

    /// <summary>Заказ по публичному токену; <c>null</c>, если токен неверный.</summary>
    /// <param name="locale">Язык названий товаров; в заказе хранится снимок на основном языке.</param>
    Task<OrderDetails?> GetByTokenAsync(string token, string locale = ContentLocales.Base, CancellationToken ct = default);

    Task<PagedResult<OrderSummary>> ListForUserAsync(Guid userId, int page, int pageSize, CancellationToken ct = default);

    /// <summary>Заказ покупателя; <c>null</c>, если заказа нет или он принадлежит другому пользователю.</summary>
    Task<OrderDetails?> GetForUserAsync(Guid userId, Guid orderId, string locale = ContentLocales.Base, CancellationToken ct = default);

    Task<PagedResult<AdminOrderSummary>> ListForAdminAsync(AdminOrderFilter filter, CancellationToken ct = default);

    Task<AdminOrderDetails?> GetForAdminAsync(Guid orderId, CancellationToken ct = default);

    /// <summary>
    /// Меняет статус, если переход разрешён <see cref="OrderWorkflow"/>. При отмене возвращает товары
    /// на склад — ровно один раз, даже при параллельных запросах.
    /// </summary>
    /// <param name="trackingNumber">ТТН при отправке (уже проверенный, см. <see cref="OrderTracking"/>).</param>
    Task<ChangeStatusResult> ChangeStatusAsync(
        Guid orderId, OrderStatus status, string? trackingNumber = null, CancellationToken ct = default);

    /// <summary>
    /// Сохраняет ТТН и заметку менеджера (значения уже проверены). <c>null</c> — заказа нет.
    /// </summary>
    Task<UpdateAdminInfoResult?> UpdateAdminInfoAsync(
        Guid orderId, string? trackingNumber, string? managerNote, CancellationToken ct = default);
}
