namespace HiFiStore.Domain.Inquiries;

/// <summary>
/// Заявка на консультацию: покупатель описывает, что ему нужно (подобрать систему, собрать на заказ,
/// вопрос по товару, сервис), и оставляет контакты. Мастер связывается сам; в админке у заявки статус и заметки.
/// </summary>
public class Inquiry
{
    public Guid Id { get; set; }

    /// <summary>Номер для общения («заявка №1042»). Выдаёт последовательность БД.</summary>
    public long Number { get; set; }

    public InquiryTopic Topic { get; set; }

    public required string Name { get; set; }

    /// <summary>Телефон в нормализованном виде: цифры и необязательный «+» в начале.</summary>
    public string? Phone { get; set; }

    public string? Email { get; set; }

    public ContactMethod PreferredContact { get; set; }

    public required string Message { get; set; }

    /// <summary>Ориентировочный бюджет — свободным текстом («до 50 000 ₴»).</summary>
    public string? Budget { get; set; }

    /// <summary>Товар, со страницы которого пришла заявка (снимок: товар могут переименовать или удалить).</summary>
    public Guid? ProductId { get; set; }

    public string? ProductName { get; set; }

    public string? ProductSlug { get; set; }

    /// <summary>Пользователь, если заявку оставили после входа.</summary>
    public Guid? UserId { get; set; }

    public InquiryStatus Status { get; set; } = InquiryStatus.New;

    /// <summary>Внутренняя заметка мастера: о чём договорились, кому перезвонить. Покупатель её не видит.</summary>
    public string? AdminNote { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

public enum InquiryTopic
{
    /// <summary>Подобрать систему или компонент.</summary>
    Selection = 0,

    /// <summary>Собрать на заказ под покупателя.</summary>
    CustomBuild = 1,

    /// <summary>Вопрос по конкретному товару или «хочу такой же».</summary>
    Product = 2,

    /// <summary>Ремонт, обслуживание, замена ламп.</summary>
    Service = 3,

    Other = 4,
}

public enum ContactMethod
{
    Phone = 0,
    Telegram = 1,
    Viber = 2,
    Email = 3,
}

public enum InquiryStatus
{
    New = 0,
    InProgress = 1,
    Closed = 2,
    Spam = 3,
}
