using HiFiStore.Api.Email;
using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Email;
using HiFiStore.Infrastructure.Orders;

namespace HiFiStore.Tests.Email;

public sealed class EmailTests
{
    private sealed class NullOutbox : IEmailOutbox
    {
        public void Enqueue(EmailMessage message)
        {
        }
    }

    [Fact]
    public void ConfirmLink_PointsToStorefront_AndKeepsIdentityParameters()
    {
        var sender = new IdentityEmailSender(new NullOutbox(), new StoreLinkOptions { PublicUrl = "https://shop.example/" });
        // Identity передаёт ссылку HTML-закодированной.
        const string identityLink =
            "http://localhost:5166/api/auth/confirmEmail?userId=42&amp;code=Q2-_Zg&amp;changedEmail=new%40example.com";

        var link = sender.StorefrontConfirmLink(identityLink);

        Assert.Equal("https://shop.example/confirm-email?userId=42&code=Q2-_Zg&changedEmail=new@example.com", link);
    }

    [Fact]
    public void StatusChanged_ForGuestOrder_HasNoLink_AndNewStatusSendsNothing()
    {
        var order = Order(OrderStatus.Shipped);

        var shipped = EmailTemplates.OrderStatusChanged(order, link: null);

        Assert.NotNull(shipped);
        Assert.Equal("guest@example.com", shipped.To);
        Assert.DoesNotContain("http", shipped.Text);
        Assert.Null(EmailTemplates.OrderStatusChanged(Order(OrderStatus.New), link: null));
    }

    [Fact]
    public void Templates_EscapeHtml()
    {
        var order = Order(OrderStatus.Confirmed) with { Customer = new OrderCustomerDto("<script>x</script>", "+380", "guest@example.com") };

        var message = EmailTemplates.OrderStatusChanged(order, "https://shop.example/account/orders/1")!;

        Assert.DoesNotContain("<script>", message.Html);
        Assert.Contains("&lt;script&gt;", message.Html);
    }

    private static AdminOrderDetails Order(OrderStatus status) => new(
        Guid.NewGuid(),
        100042,
        status,
        [],
        UserId: null,
        new OrderCustomerDto("Гість", "+380671234567", "guest@example.com"),
        new OrderDeliveryDto(DeliveryMethod.Pickup, null, null, null, null, null),
        PaymentMethod.CashOnDelivery,
        Comment: null,
        [],
        1000m,
        DateTimeOffset.UtcNow,
        DateTimeOffset.UtcNow);
}
