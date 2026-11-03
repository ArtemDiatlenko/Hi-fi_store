namespace HiFiStore.Domain.Orders;

/// <summary>Способ оплаты. Онлайн-оплаты пока нет.</summary>
public enum PaymentMethod
{
    /// <summary>Наложенный платёж или оплата при самовывозе.</summary>
    CashOnDelivery = 0,

    /// <summary>Безналичный расчёт по счёту.</summary>
    BankTransfer = 1,
}
