namespace HiFiStore.Domain.Orders;

/// <summary>
/// Допустимые переходы между статусами заказа:
/// <code>
/// New ──► Confirmed ──► Shipped ──► Completed
///  │          │            │
///  └──────────┴────────────┴──► Cancelled
/// </code>
/// <see cref="OrderStatus.Completed"/> и <see cref="OrderStatus.Cancelled"/> — конечные статусы.
/// Отмена отправленного заказа означает отказ при получении: посылка возвращается в магазин.
/// </summary>
public static class OrderWorkflow
{
    private static readonly Dictionary<OrderStatus, OrderStatus[]> Transitions = new()
    {
        [OrderStatus.New] = [OrderStatus.Confirmed, OrderStatus.Cancelled],
        [OrderStatus.Confirmed] = [OrderStatus.Shipped, OrderStatus.Cancelled],
        [OrderStatus.Shipped] = [OrderStatus.Completed, OrderStatus.Cancelled],
        [OrderStatus.Completed] = [],
        [OrderStatus.Cancelled] = [],
    };

    public static IReadOnlyList<OrderStatus> NextStatuses(OrderStatus current) =>
        Transitions.TryGetValue(current, out var next) ? next : [];

    public static bool CanTransition(OrderStatus from, OrderStatus to) => NextStatuses(from).Contains(to);
}
