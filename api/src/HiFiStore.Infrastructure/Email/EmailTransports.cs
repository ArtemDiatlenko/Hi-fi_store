using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Logging;

namespace HiFiStore.Infrastructure.Email;

/// <summary>
/// Отправка через SMTP встроенным клиентом .NET. Подходит любой почтовый сервис с SMTP (Gmail, Brevo, SendGrid,
/// Resend, Mailgun, почта на своём домене) — достаточно поменять настройки, код не меняется.
/// </summary>
public sealed class SmtpEmailTransport(EmailOptions options) : IEmailTransport
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var smtp = options.Smtp;
        using var client = new SmtpClient(smtp.Host, smtp.Port)
        {
            EnableSsl = smtp.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Credentials = string.IsNullOrEmpty(smtp.Username) ? null : new NetworkCredential(smtp.Username, smtp.Password),
        };

        using var mail = new MailMessage
        {
            From = new MailAddress(options.From, options.FromName, Encoding.UTF8),
            Subject = message.Subject,
            SubjectEncoding = Encoding.UTF8,
            Body = message.Text,
            BodyEncoding = Encoding.UTF8,
        };
        mail.To.Add(message.To);
        if (!string.IsNullOrWhiteSpace(options.ReplyTo))
        {
            mail.ReplyToList.Add(options.ReplyTo);
        }
        mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(message.Html, Encoding.UTF8, "text/html"));

        await client.SendMailAsync(mail, ct);
    }
}

/// <summary>Демонстрация без отправки: письмо целиком пишется в лог (адрес, тема, текст со ссылками).</summary>
public sealed class LogEmailTransport(ILogger<LogEmailTransport> logger) : IEmailTransport
{
    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Демонстрация почты (Log): письмо не отправлено.\nКому: {To}\nТема: {Subject}\n\n{Text}",
            message.To, message.Subject, message.Text);
        return Task.CompletedTask;
    }
}

public static class EmailTransportFactory
{
    public static bool IsSmtpConfigured(EmailOptions options) => !string.IsNullOrWhiteSpace(options.Smtp.Host);

    public static string Provider(EmailOptions options)
    {
        if (!string.Equals(options.Provider, "Auto", StringComparison.OrdinalIgnoreCase))
        {
            return options.Provider?.Trim().ToLowerInvariant() ?? "";
        }

        if (!string.IsNullOrWhiteSpace(options.Resend.ApiKey)) return "resend";
        return IsSmtpConfigured(options) ? "smtp" : "log";
    }

    public static void Validate(EmailOptions options)
    {
        var provider = Provider(options);
        if (provider is not ("log" or "smtp" or "resend"))
        {
            throw new InvalidOperationException("Email:Provider должен быть Auto, Log, Smtp или Resend.");
        }

        if (provider == "log") return;

        if (!ValidAddress(options.From))
        {
            throw new InvalidOperationException("Задайте Email__From — корректный адрес отправителя без отображаемого имени.");
        }

        if (!string.IsNullOrWhiteSpace(options.ReplyTo) && !ValidAddress(options.ReplyTo))
        {
            throw new InvalidOperationException("Email__ReplyTo должен быть корректным email.");
        }

        if (options.FromName.Contains('\r') || options.FromName.Contains('\n'))
        {
            throw new InvalidOperationException("Email__FromName не должен содержать переводы строк.");
        }

        if (provider == "resend" && string.IsNullOrWhiteSpace(options.Resend.ApiKey))
        {
            throw new InvalidOperationException(
                "Выбран Resend, но не задан Email__Resend__ApiKey.");
        }

        if (provider == "smtp" && (!IsSmtpConfigured(options) || options.Smtp.Port is < 1 or > 65535 or 465))
        {
            throw new InvalidOperationException("Для SMTP задайте Email__Smtp__Host и порт от 1 до 65535, кроме 465 (не поддерживается).");
        }
    }

    private static bool ValidAddress(string value) =>
        !string.IsNullOrWhiteSpace(value) && !value.Contains('\r') && !value.Contains('\n') &&
        MailAddress.TryCreate(value, out var address) && address.Address == value;
}
