using System.Threading.Channels;
using HiFiStore.Infrastructure.Email;

namespace HiFiStore.Api.Email;

/// <summary>
/// Очередь писем в памяти процесса. Письма, не отправленные до остановки API, теряются — для уведомлений
/// магазина это приемлемо; если понадобится гарантия доставки, очередь можно перенести в базу.
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
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                if (attempt >= RetryDelays.Length)
                {
                    logger.LogError(ex, "Не удалось отправить письмо «{Subject}» на {To}.", message.Subject, message.To);
                    return;
                }

                logger.LogWarning(ex, "Ошибка отправки письма «{Subject}», повтор через {Delay}.", message.Subject, RetryDelays[attempt]);
                await Task.Delay(RetryDelays[attempt], ct);
            }
        }
    }
}
