namespace HiFiStore.Domain.Orders;

/// <summary>
/// Статус заказа. Допустимые переходы описаны в <see cref="OrderWorkflow"/>.
/// </summary>
public enum OrderStatus
{
    /// <summary>Только что оформлен, менеджер ещё не связался с покупателем.</summary>
    New = 0,

    /// <summary>Подтверждён менеджером: наличие и доставка согласованы.</summary>
    Confirmed = 1,

    /// <summary>Передан в службу доставки.</summary>
    Shipped = 2,

    /// <summary>Получен покупателем.</summary>
    Completed = 3,

    /// <summary>Отменён. Товары при отмене возвращаются на склад.</summary>
    Cancelled = 4,
}
