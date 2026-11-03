namespace HiFiStore.Infrastructure.Email;

/// <summary>
/// Настройки почты (секция <c>Email</c>). Без <c>Email:Smtp:Host</c> письма не отправляются, а пишутся в лог —
/// так удобно разрабатывать: ссылки подтверждения и сброса пароля видны в выводе API.
/// </summary>
public sealed class EmailOptions
{
    public const string Section = "Email";

    /// <summary>Адрес отправителя. Для SMTP обязателен; обычно совпадает с учётной записью SMTP.</summary>
    public string From { get; set; } = "";

    public string FromName { get; set; } = "Hi-Fi Store";

    public SmtpOptions Smtp { get; set; } = new();
}

public sealed class SmtpOptions
{
    /// <summary>Сервер SMTP (например, smtp.gmail.com, smtp-relay.brevo.com). Пусто — письма идут в лог.</summary>
    public string? Host { get; set; }

    /// <summary>587 — STARTTLS (по умолчанию), 465 не поддерживается встроенным клиентом .NET.</summary>
    public int Port { get; set; } = 587;

    public string? Username { get; set; }

    public string? Password { get; set; }

    public bool EnableSsl { get; set; } = true;
}

/// <summary>
/// Адреса для писем (секция <c>Store</c>): ссылки в письмах ведут на витрину, а не на API.
/// </summary>
public sealed class StoreLinkOptions
{
    /// <summary>Публичный адрес витрины без завершающего «/», например https://hifistore-web.onrender.com.</summary>
    public string PublicUrl { get; set; } = "http://localhost:3000";

    /// <summary>Куда присылать уведомления о новых заказах. Пусто — владельцу не пишем.</summary>
    public string? OwnerEmail { get; set; }

    public string Link(string path) => PublicUrl.TrimEnd('/') + path;
}
