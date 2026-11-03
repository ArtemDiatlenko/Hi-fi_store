using HiFiStore.Domain.Orders;

namespace HiFiStore.Infrastructure.Orders;

/// <summary>Русские названия статусов для сообщений API.</summary>
public static class OrderLabels
{
    public static string Status(OrderStatus status) => status switch
    {
        OrderStatus.New => "Новый",
        OrderStatus.Confirmed => "Подтверждён",
        OrderStatus.Shipped => "Отправлен",
        OrderStatus.Completed => "Выполнен",
        OrderStatus.Cancelled => "Отменён",
        _ => status.ToString(),
    };
}
