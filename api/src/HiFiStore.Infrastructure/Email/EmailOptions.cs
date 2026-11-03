namespace HiFiStore.Infrastructure.Email;

/// <summary>
/// Настройки почты (секция <c>Email</c>). Auto выбирает Resend по ключу API, затем SMTP по Host,
/// иначе пишет письмо в лог. Для явного выбора: Log, Smtp или Resend.
/// </summary>
public sealed class EmailOptions
{
    public const string Section = "Email";

    public string Provider { get; set; } = "Auto";

    /// <summary>Адрес отправителя без отображаемого имени. Обязателен для реальной отправки.</summary>
    public string From { get; set; } = "";

    public string FromName { get; set; } = "Hi-Fi Store";

    /// <summary>Рабочий адрес для ответов клиентов; необязателен.</summary>
    public string? ReplyTo { get; set; }

    public ResendOptions Resend { get; set; } = new();

    public SmtpOptions Smtp { get; set; } = new();
}

public sealed class ResendOptions
{
    /// <summary>Секретный ключ с правом отправки. Задаётся через Email__Resend__ApiKey.</summary>
    public string? ApiKey { get; set; }
}

public sealed class SmtpOptions
{
    /// <summary>Сервер SMTP (например, smtp.gmail.com). Обязателен при Email:Provider=Smtp.</summary>
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
