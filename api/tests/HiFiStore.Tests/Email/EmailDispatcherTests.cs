using HiFiStore.Api.Email;
using HiFiStore.Infrastructure.Email;
using Microsoft.Extensions.Logging.Abstractions;

namespace HiFiStore.Tests.Email;

public sealed class EmailDispatcherTests
{
    [Fact]
    public async Task PermanentFailure_DoesNotRetryOrBlockFollowingEmail()
    {
        var outbox = new EmailOutbox();
        var received = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var attempts = 0;
        var transport = new Transport((message, ct) =>
        {
            Interlocked.Increment(ref attempts);
            if (message.To == "bad@example.com") throw new EmailDeliveryException("Forbidden", retryable: false);
            received.TrySetResult();
            return Task.CompletedTask;
        });
        using var dispatcher = new EmailDispatcher(outbox, transport, NullLogger<EmailDispatcher>.Instance);
        await dispatcher.StartAsync(default);
        try
        {
            outbox.Enqueue(new EmailMessage("bad@example.com", "Bad", "Text", "Html"));
            outbox.Enqueue(new EmailMessage("good@example.com", "Good", "Text", "Html"));
            await received.Task.WaitAsync(TimeSpan.FromSeconds(10));
            Assert.Equal(2, attempts);
        }
        finally { await dispatcher.StopAsync(default); }
    }

    [Fact]
    public async Task HttpTimeout_RetriesSameMessage_WithoutStoppingDispatcher()
    {
        var outbox = new EmailOutbox();
        var received = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var ids = new List<Guid>();
        var transport = new Transport((message, ct) =>
        {
            ids.Add(message.DeliveryId);
            if (ids.Count == 1) throw new TaskCanceledException("Simulated HTTP timeout, not host shutdown");
            received.TrySetResult();
            return Task.CompletedTask;
        });
        using var dispatcher = new EmailDispatcher(outbox, transport, NullLogger<EmailDispatcher>.Instance);
        await dispatcher.StartAsync(default);
        try
        {
            outbox.Enqueue(new EmailMessage("buyer@example.com", "Test", "Text", "Html"));
            await received.Task.WaitAsync(TimeSpan.FromSeconds(20));
            Assert.Equal(2, ids.Count);
            Assert.Equal(ids[0], ids[1]);
            Assert.False(dispatcher.ExecuteTask!.IsCompleted);
        }
        finally { await dispatcher.StopAsync(default); }
    }

    private sealed class Transport(Func<EmailMessage, CancellationToken, Task> send) : IEmailTransport
    {
        public Task SendAsync(EmailMessage message, CancellationToken ct = default) => send(message, ct);
    }
}
