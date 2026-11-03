using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;

namespace HiFiStore.Infrastructure.Email;

/// <summary>HTTP API на порту 443: подходит в том числе для бесплатного Render с заблокированным SMTP.</summary>
public sealed class ResendEmailTransport(IHttpClientFactory clients, EmailOptions options) : IEmailTransport
{
    public const string ClientName = "ResendEmail";

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        using var client = clients.CreateClient(ClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Resend.ApiKey);
        request.Headers.Add("Idempotency-Key", $"hifistore/{message.DeliveryId:N}");
        var body = new Dictionary<string, object>
        {
            ["from"] = new MailAddress(options.From, options.FromName).ToString(),
            ["to"] = new[] { message.To },
            ["subject"] = message.Subject,
            ["text"] = message.Text,
            ["html"] = message.Html,
        };
        if (!string.IsNullOrWhiteSpace(options.ReplyTo)) body["reply_to"] = options.ReplyTo;
        request.Content = JsonContent.Create(body);

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var retryable = response.StatusCode is HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests ||
                (int)response.StatusCode >= 500;
            var retryAfter = response.Headers.RetryAfter?.Delta;
            if (retryAfter is null && response.Headers.RetryAfter?.Date is { } date)
                retryAfter = date - DateTimeOffset.UtcNow;

            // Тело ответа не выводим: провайдер может вернуть в нём контакты или содержимое письма.
            throw new EmailDeliveryException($"Resend отклонил отправку (HTTP {(int)response.StatusCode}). Проверьте настройки и журнал провайдера.",
                retryable, retryAfter);
        }
    }
}

public sealed class EmailDeliveryException(string message, bool retryable, TimeSpan? retryAfter = null) : Exception(message)
{
    public bool Retryable { get; } = retryable;
    public TimeSpan? RetryAfter { get; } = retryAfter;
}
