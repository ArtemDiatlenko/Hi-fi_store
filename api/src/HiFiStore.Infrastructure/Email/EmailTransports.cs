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
        mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(message.Html, Encoding.UTF8, "text/html"));

        await client.SendMailAsync(mail, ct);
    }
}

/// <summary>Без SMTP: письмо целиком пишется в лог (адрес, тема, текст со ссылками).</summary>
public sealed class LogEmailTransport(ILogger<LogEmailTransport> logger) : IEmailTransport
{
    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Письмо не отправлено (SMTP не настроен, Email:Smtp:Host пуст).\nКому: {To}\nТема: {Subject}\n\n{Text}",
            message.To, message.Subject, message.Text);
        return Task.CompletedTask;
    }
}

public static class EmailTransportFactory
{
    public static bool IsSmtpConfigured(EmailOptions options) => !string.IsNullOrWhiteSpace(options.Smtp.Host);

    public static void Validate(EmailOptions options)
    {
        if (IsSmtpConfigured(options) && string.IsNullOrWhiteSpace(options.From))
        {
            throw new InvalidOperationException(
                "Задан Email:Smtp:Host, но не задан Email:From — адрес отправителя. " +
                "Задайте переменную окружения Email__From.");
        }
    }
}
