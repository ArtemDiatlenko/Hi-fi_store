using System.Threading.Channels;
using HiFiStore.Infrastructure.Email;

namespace HiFiStore.Api.Email;

/// <summary>
/// Демонстрационная очередь писем в памяти процесса. Неотправленные письма теряются при остановке API;
/// для надёжной доставки в рабочем магазине нужна сохраняемая очередь.
/// </summary>
public sealed class EmailOutbox : IEmailOutbox
{
    private readonly Channel<EmailMessage> _channel =
        Channel.CreateUnbounded<EmailMessage>(new UnboundedChannelOptions { SingleReader = true });

    public ChannelReader<EmailMessage> Reader => _channel.Reader;

    public void Enqueue(EmailMessage message) => _channel.Writer.TryWrite(message);
}

/// <summary>Отправляет письма из очереди по одному; при ошибке пробует ещё дважды, затем пишет ошибку в лог.</summary>
public sealed class EmailDispatcher(EmailOutbox outbox, IEmailTransport transport, ILogger<EmailDispatcher> logger)
    : BackgroundService
{
    private static readonly TimeSpan[] RetryDelays = [TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(30)];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in outbox.Reader.ReadAllAsync(stoppingToken))
        {
            await SendWithRetriesAsync(message, stoppingToken);
        }
    }

    private async Task SendWithRetriesAsync(EmailMessage message, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await transport.SendAsync(message, ct);
                return;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                if (attempt >= RetryDelays.Length || ex is EmailDeliveryException { Retryable: false })
                {
                    logger.LogError(ex, "Не удалось отправить письмо «{Subject}» на {To}.", message.Subject, message.To);
                    return;
                }

                var delay = RetryDelays[attempt];
                if (ex is EmailDeliveryException { RetryAfter: { } requested } && requested > delay)
                    delay = requested < TimeSpan.FromMinutes(5) ? requested : TimeSpan.FromMinutes(5);
                logger.LogWarning(ex, "Ошибка отправки письма «{Subject}», повтор через {Delay}.", message.Subject, delay);
                await Task.Delay(delay, ct);
            }
        }
    }
}
