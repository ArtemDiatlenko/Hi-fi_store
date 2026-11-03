namespace HiFiStore.Infrastructure.Email;

/// <summary>Письмо: текстовая и HTML-версии одного содержания.</summary>
public sealed record EmailMessage(string To, string Subject, string Text, string Html);

/// <summary>
/// Очередь исходящих писем. Письмо ставится в очередь и отправляется в фоне, поэтому медленный или недоступный
/// почтовый сервер не задерживает и не ломает запрос (оформление заказа, регистрацию).
/// </summary>
public interface IEmailOutbox
{
    void Enqueue(EmailMessage message);
}

/// <summary>Непосредственная отправка: SMTP или запись в лог (<see cref="EmailTransportFactory"/>).</summary>
public interface IEmailTransport
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
