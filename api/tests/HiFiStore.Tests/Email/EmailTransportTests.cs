using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using HiFiStore.Infrastructure;
using HiFiStore.Infrastructure.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Email;

public sealed class EmailTransportTests
{
    [Theory]
    [InlineData("Log", typeof(LogEmailTransport))]
    [InlineData("Resend", typeof(ResendEmailTransport))]
    [InlineData("Smtp", typeof(SmtpEmailTransport))]
    public void ConfiguredProvider_IsResolvedByApplicationServices(string provider, Type transportType)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Store"] = "Host=localhost;Database=not_used",
            ["Email:Provider"] = provider,
            ["Email:From"] = "shop@example.com",
            ["Email:Resend:ApiKey"] = "test-key",
            ["Email:Smtp:Host"] = "smtp.example.com",
        }).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddStoreInfrastructure(configuration);
        using var providerServices = services.BuildServiceProvider();
        Assert.IsType(transportType, providerServices.GetRequiredService<IEmailTransport>());
    }

    [Fact]
    public void Default_IsDemoLog_AndExplicitResendRequiresCredentials()
    {
        Assert.Equal("log", EmailTransportFactory.Provider(new EmailOptions()));
        EmailTransportFactory.Validate(new EmailOptions());
        Assert.Throws<InvalidOperationException>(() => EmailTransportFactory.Validate(new EmailOptions
            { Provider = "Resend", From = "shop@example.com" }));
        Assert.Throws<InvalidOperationException>(() => EmailTransportFactory.Validate(new EmailOptions
            { Provider = "Unknown" }));
    }

    [Fact]
    public void AutoPrefersResend_AndExplicitLogDoesNotSendWithStoredCredentials()
    {
        var options = Options();
        options.Provider = "Auto";
        options.Smtp.Host = "smtp.example.com";
        Assert.Equal("resend", EmailTransportFactory.Provider(options));
        options.Provider = "Log";
        Assert.Equal("log", EmailTransportFactory.Provider(options));
        options.Resend.ApiKey = null;
        options.Provider = "Auto";
        Assert.Equal("smtp", EmailTransportFactory.Provider(options));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-address")]
    [InlineData("Shop <shop@example.com>")]
    [InlineData("shop@example.com\r\nBcc: other@example.com")]
    public void Sending_RejectsInvalidSender(string from)
    {
        var options = Options();
        options.From = from;
        Assert.Throws<InvalidOperationException>(() => EmailTransportFactory.Validate(options));
    }

    [Fact]
    public async Task Resend_SendsBothFormatsAndReplyTo_WithStableKeyForRetries()
    {
        var keys = new List<string>();
        var handler = new Handler(async (request, ct) =>
        {
            Assert.Equal("https://api.resend.com/emails", request.RequestUri!.ToString());
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
            Assert.Equal("test-key", request.Headers.Authorization.Parameter);
            keys.Add(request.Headers.GetValues("Idempotency-Key").Single());
            var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct)).RootElement;
            var sender = new System.Net.Mail.MailAddress(json.GetProperty("from").GetString()!);
            Assert.Equal("shop@example.com", sender.Address);
            Assert.Equal("Hi-Fi Store", sender.DisplayName);
            Assert.Equal("buyer@example.com", json.GetProperty("to")[0].GetString());
            Assert.Equal("Тест", json.GetProperty("subject").GetString());
            Assert.Equal("Текст", json.GetProperty("text").GetString());
            Assert.Equal("<p>Текст</p>", json.GetProperty("html").GetString());
            Assert.Equal("support@example.com", json.GetProperty("reply_to").GetString());
            return new HttpResponseMessage(HttpStatusCode.OK);
        });
        using (handler)
        {
            var transport = new ResendEmailTransport(new ClientFactory(handler), Options());
            var message = new EmailMessage("buyer@example.com", "Тест", "Текст", "<p>Текст</p>");
            await transport.SendAsync(message);
            await transport.SendAsync(message);
            Assert.Equal(2, keys.Count);
            Assert.Equal(keys[0], keys[1]);
            Assert.NotEqual(message.DeliveryId, new EmailMessage(message.To, message.Subject, message.Text, message.Html).DeliveryId);
        }
    }

    [Theory]
    [InlineData(400, false)]
    [InlineData(401, false)]
    [InlineData(403, false)]
    [InlineData(422, false)]
    [InlineData(408, true)]
    [InlineData(429, true)]
    [InlineData(500, true)]
    [InlineData(503, true)]
    public async Task Resend_ClassifiesFailures_AndDoesNotExposeResponseBody(int status, bool retryable)
    {
        using var handler = new Handler((request, ct) =>
        {
            var response = new HttpResponseMessage((HttpStatusCode)status) { Content = new StringContent("private-message-test-key") };
            response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(60));
            return Task.FromResult(response);
        });
        var transport = new ResendEmailTransport(new ClientFactory(handler), Options());
        var failure = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            transport.SendAsync(new EmailMessage("buyer@example.com", "Test", "Text", "<p>Text</p>")));
        Assert.Equal(retryable, failure.Retryable);
        Assert.Equal(TimeSpan.FromSeconds(60), failure.RetryAfter);
        Assert.DoesNotContain("private-message", failure.ToString());
        Assert.DoesNotContain("test-key", failure.ToString());
    }

    [Fact]
    public async Task Resend_OmitsUnsetReplyTo_AndHonorsCancellation()
    {
        var options = Options();
        options.ReplyTo = null;
        using var handler = new Handler(async (request, ct) =>
        {
            var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct)).RootElement;
            Assert.False(json.TryGetProperty("reply_to", out _));
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });
        var transport = new ResendEmailTransport(new ClientFactory(handler), options);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            transport.SendAsync(new EmailMessage("buyer@example.com", "Test", "Text", "Html"), cancellation.Token));
    }

    private static EmailOptions Options() => new()
    {
        Provider = "Resend",
        From = "shop@example.com",
        ReplyTo = "support@example.com",
        Resend = new ResendOptions { ApiKey = "test-key" },
    };

    private sealed class Handler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => send(request, ct);
    }

    private sealed class ClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }
}
