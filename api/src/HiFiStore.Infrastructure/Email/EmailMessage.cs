namespace HiFiStore.Infrastructure.Email;

/// <summary>Письмо: текстовая и HTML-версии одного содержания.</summary>
public sealed record EmailMessage(string To, string Subject, string Text, string Html)
{
    /// <summary>Один ключ на письмо и все повторные попытки отправки через HTTP API.</summary>
    public Guid DeliveryId { get; init; } = Guid.NewGuid();
}

/// <summary>
/// Очередь исходящих писем. Письмо ставится в очередь и отправляется в фоне, поэтому медленный или недоступный
/// почтовый сервер не задерживает и не ломает запрос (оформление заказа, регистрацию).
/// </summary>
public interface IEmailOutbox
{
    void Enqueue(EmailMessage message);
}

/// <summary>Непосредственная отправка: HTTP API, SMTP или запись в лог.</summary>
public interface IEmailTransport
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
