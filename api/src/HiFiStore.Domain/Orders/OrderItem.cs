namespace HiFiStore.Domain.Orders;

/// <summary>
/// Позиция заказа — снимок товара на момент оформления. Артикул, название и цена копируются,
/// поэтому последующие изменения или удаление товара не меняют уже оформленный заказ.
/// </summary>
public class OrderItem
{
    public Guid Id { get; set; }

    public Guid OrderId { get; set; }

    /// <summary>Идентификатор товара в каталоге. Внешнего ключа нет: товар могут удалить, а заказ останется.</summary>
    public Guid ProductId { get; set; }

    public required string Sku { get; set; }

    public required string Name { get; set; }

    public decimal UnitPrice { get; set; }

    public int Quantity { get; set; }

    public decimal LineTotal { get; set; }
}
