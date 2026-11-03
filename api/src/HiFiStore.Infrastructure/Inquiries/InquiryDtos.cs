using HiFiStore.Domain.Inquiries;

namespace HiFiStore.Infrastructure.Inquiries;

/// <summary>Заявка с витрины. Перечисления — строками (<c>"CustomBuild"</c>, <c>"Telegram"</c>).</summary>
public sealed record InquiryRequest
{
    public string? Topic { get; init; }
    public string? Name { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? PreferredContact { get; init; }
    public string? Message { get; init; }
    public string? Budget { get; init; }

    /// <summary>Slug товара, со страницы которого пришла заявка.</summary>
    public string? ProductSlug { get; init; }

    /// <summary>Согласие на обработку персональных данных — обязательно.</summary>
    public bool Consent { get; init; }

    /// <summary>Поле-ловушка для ботов: на витрине скрыто, человек его не заполняет.</summary>
    public string? Website { get; init; }
}

public sealed record ValidatedInquiry(
    InquiryTopic Topic,
    string Name,
    string? Phone,
    string? Email,
    ContactMethod PreferredContact,
    string Message,
    string? Budget,
    string? ProductSlug);

/// <summary>Ответ витрине: номер, чтобы покупатель мог на него сослаться.</summary>
public sealed record InquiryCreated(long Number);

public sealed record AdminInquirySummary(
    Guid Id,
    long Number,
    InquiryTopic Topic,
    InquiryStatus Status,
    string Name,
    string? Phone,
    string? Email,
    ContactMethod PreferredContact,
    string MessagePreview,
    string? ProductName,
    DateTimeOffset CreatedAt);

public sealed record AdminInquiryDetails(
    Guid Id,
    long Number,
    InquiryTopic Topic,
    InquiryStatus Status,
    string Name,
    string? Phone,
    string? Email,
    ContactMethod PreferredContact,
    string Message,
    string? Budget,
    Guid? ProductId,
    string? ProductName,
    string? ProductSlug,
    Guid? UserId,
    string? AdminNote,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record AdminInquiryFilter(InquiryStatus? Status, string? Search, int Page, int PageSize);

/// <summary>Изменение заявки в админке: статус и/или заметка (null — не менять).</summary>
public sealed record UpdateInquiryRequest(string? Status, string? AdminNote);
