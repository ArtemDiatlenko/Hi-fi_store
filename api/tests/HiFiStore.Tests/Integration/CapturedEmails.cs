using System.Collections.Concurrent;
using HiFiStore.Infrastructure.Email;

namespace HiFiStore.Tests.Integration;

/// <summary>
/// Транспорт писем для интеграционных тестов: ничего не отправляет, а запоминает письма.
/// Письма уходят из фоновой очереди, поэтому тесты ждут нужное письмо через <see cref="WaitForAsync"/>.
/// </summary>
public sealed class CapturedEmails : IEmailTransport
{
    private readonly ConcurrentQueue<EmailMessage> _messages = new();

    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        _messages.Enqueue(message);
        return Task.CompletedTask;
    }

    public IReadOnlyList<EmailMessage> To(string address) =>
        _messages.Where(m => string.Equals(m.To, address, StringComparison.OrdinalIgnoreCase)).ToList();

    /// <summary>Ждёт письмо на адрес, тема которого содержит <paramref name="subjectPart"/>.</summary>
    public async Task<EmailMessage> WaitForAsync(string to, string subjectPart, TimeSpan? timeout = null)
    {
        var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(10));
        while (DateTime.UtcNow < deadline)
        {
            var message = To(to).FirstOrDefault(m => m.Subject.Contains(subjectPart, StringComparison.Ordinal));
            if (message is not null)
            {
                return message;
            }

            await Task.Delay(50);
        }

        throw new TimeoutException($"Письмо «{subjectPart}» на {to} не пришло. Пришли: " +
            string.Join("; ", To(to).Select(m => m.Subject)));
    }

    /// <summary>Первая ссылка в тексте письма, начинающаяся с <paramref name="prefix"/>.</summary>
    public static Uri LinkIn(EmailMessage message, string prefix)
    {
        var start = message.Text.IndexOf(prefix, StringComparison.Ordinal);
        Assert.True(start >= 0, $"В письме нет ссылки {prefix}: {message.Text}");
        var end = message.Text.IndexOfAny([' ', '\n', '\r'], start);
        return new Uri(end < 0 ? message.Text[start..] : message.Text[start..end]);
    }
}
