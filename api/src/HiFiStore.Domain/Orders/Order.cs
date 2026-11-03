namespace HiFiStore.Domain.Orders;

public class Order
{
    public Guid Id { get; set; }

    /// <summary>
    /// Номер для общения с покупателем («заказ №100042»). Выдаётся последовательностью БД,
    /// поэтому легко угадывается и не даёт доступа к заказу — для этого есть <see cref="PublicTokenHash"/>.
    /// </summary>
    public long Number { get; set; }

    /// <summary>
    /// SHA-256 от публичного токена страницы подтверждения. Сам токен отдаётся покупателю
    /// один раз при оформлении и в базе не хранится.
    /// </summary>
    public required string PublicTokenHash { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.New;

    /// <summary>Покупатель, если заказ оформлен после входа; <c>null</c> — гостевой заказ.</summary>
    public Guid? UserId { get; set; }

    public required string CustomerName { get; set; }

    /// <summary>Телефон в нормализованном виде: цифры и необязательный «+» в начале.</summary>
    public required string CustomerPhone { get; set; }

    public required string CustomerEmail { get; set; }

    public DeliveryMethod DeliveryMethod { get; set; }

    /// <summary>Город текстом. Для самовывоза не заполняется.</summary>
    public string? DeliveryCity { get; set; }

    /// <summary>Ref города в справочнике Новой почты — заполнится, когда появится интеграция со справочником.</summary>
    public string? DeliveryCityRef { get; set; }

    /// <summary>Отделение или почтомат текстом (для доставки в отделение).</summary>
    public string? DeliveryWarehouse { get; set; }

    /// <summary>Ref отделения в справочнике Новой почты.</summary>
    public string? DeliveryWarehouseRef { get; set; }

    /// <summary>Адрес для курьерской доставки.</summary>
    public string? DeliveryAddress { get; set; }

    public PaymentMethod PaymentMethod { get; set; }

    public string? CustomerComment { get; set; }

    public List<OrderItem> Items { get; set; } = [];

    public decimal Total { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
