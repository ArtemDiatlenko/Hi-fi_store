using HiFiStore.Infrastructure.Orders;

namespace HiFiStore.Infrastructure.Email;

/// <summary>
/// Письма о заказах: покупателю — «замовлення прийнято» и смена статуса, владельцу — новый заказ
/// (если задан <c>Store:OwnerEmail</c>). Письма ставятся в очередь и не влияют на результат запроса.
/// </summary>
public sealed class OrderNotifier(IEmailOutbox outbox, StoreLinkOptions links)
{
    public void OrderPlaced(CheckoutResponse placed)
    {
        var order = placed.Order;
        outbox.Enqueue(EmailTemplates.OrderPlaced(order, links.Link($"/orders/{placed.Token}")));

        if (!string.IsNullOrWhiteSpace(links.OwnerEmail))
        {
            outbox.Enqueue(EmailTemplates.NewOrderForOwner(links.OwnerEmail, order, links.Link($"/admin/order/{order.Id}")));
        }
    }

    public void StatusChanged(AdminOrderDetails order)
    {
        var link = order.UserId is null ? null : links.Link($"/account/orders/{order.Id}");
        if (EmailTemplates.OrderStatusChanged(order, link) is { } message)
        {
            outbox.Enqueue(message);
        }
    }
}
