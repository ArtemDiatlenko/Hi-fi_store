namespace HiFiStore.Domain.Orders;

public enum DeliveryMethod
{
    /// <summary>Новая почта, отделение или почтомат.</summary>
    NovaPoshtaWarehouse = 0,

    /// <summary>Новая почта, курьер по адресу.</summary>
    NovaPoshtaCourier = 1,

    /// <summary>Самовывоз из магазина.</summary>
    Pickup = 2,
}
