using System.Globalization;
using System.Net;
using System.Text;
using HiFiStore.Domain.Inquiries;
using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Inquiries;
using HiFiStore.Infrastructure.Orders;

namespace HiFiStore.Infrastructure.Email;

/// <summary>
/// Тексты писем. Витрина по умолчанию украинская, поэтому письма тоже на украинском.
/// Каждое письмо собирается в двух видах: обычный текст (для почтовиков без HTML и для лога) и простой HTML.
/// </summary>
public static class EmailTemplates
{
    private const string Brand = "Hi-Fi Store";
    private static readonly CultureInfo Uk = CultureInfo.GetCultureInfo("uk-UA");

    public static EmailMessage ConfirmEmail(string to, string link) => Build(
        to,
        "Підтвердіть email",
        [
            Paragraph("Дякуємо за реєстрацію в Hi-Fi Store!"),
            Paragraph("Щоб підтвердити адресу електронної пошти, перейдіть за посиланням:"),
            Button("Підтвердити email", link),
            Muted("Якщо ви не реєструвалися, просто проігноруйте цей лист."),
        ]);

    public static EmailMessage ResetPassword(string to, string link) => Build(
        to,
        "Відновлення пароля",
        [
            Paragraph("Ви (або хтось інший) попросили відновити пароль до акаунта в Hi-Fi Store."),
            Paragraph("Щоб задати новий пароль, перейдіть за посиланням:"),
            Button("Задати новий пароль", link),
            Muted("Якщо ви не просили відновити пароль, проігноруйте цей лист — пароль не зміниться."),
        ]);

    public static EmailMessage OrderPlaced(OrderDetails order, string link) => Build(
        order.Customer.Email,
        $"Замовлення №{order.Number} прийнято",
        [
            Paragraph($"Вітаємо, {order.Customer.FullName}!"),
            Paragraph($"Ми отримали ваше замовлення №{order.Number}. Менеджер зв’яжеться з вами, щоб підтвердити наявність і доставку."),
            Items(order.Items, order.Total),
            Paragraph($"Доставка: {Delivery(order.Delivery)}"),
            Paragraph($"Оплата: {Payment(order.PaymentMethod)}"),
            Button("Переглянути замовлення", link),
        ]);

    public static EmailMessage NewOrderForOwner(string to, OrderDetails order, string link) => Build(
        to,
        $"Нове замовлення №{order.Number} — {Money(order.Total)}",
        [
            Paragraph($"Покупець: {order.Customer.FullName}, {Phones.Display(order.Customer.Phone)}, {order.Customer.Email}"),
            Items(order.Items, order.Total),
            Paragraph($"Доставка: {Delivery(order.Delivery)}"),
            Paragraph($"Оплата: {Payment(order.PaymentMethod)}"),
            order.Comment is { Length: > 0 } comment ? Paragraph($"Коментар: {comment}") : Block.Empty,
            Button("Відкрити в адмін-панелі", link),
        ]);

    /// <summary>
    /// Письмо о новом статусе; <c>null</c> для статусов, о которых покупателю писать не нужно.
    /// <paramref name="link"/> — страница заказа в личном кабинете; у гостевого заказа её нет (токен хранится только хешем).
    /// </summary>
    public static EmailMessage? OrderStatusChanged(AdminOrderDetails order, string? link)
    {
        var text = order.Status switch
        {
            OrderStatus.Confirmed => "підтверджено. Готуємо його до відправлення.",
            OrderStatus.Shipped => "передано в службу доставки.",
            OrderStatus.Completed => "виконано. Дякуємо за покупку!",
            OrderStatus.Cancelled => "скасовано. Якщо це помилка, зв’яжіться з нами.",
            _ => null,
        };
        if (text is null)
        {
            return null;
        }

        return Build(
            order.Customer.Email,
            $"Замовлення №{order.Number}: {Status(order.Status).ToLower(Uk)}",
            [
                Paragraph($"Вітаємо, {order.Customer.FullName}!"),
                Paragraph($"Ваше замовлення №{order.Number} {text}"),
                order.Status == OrderStatus.Shipped && order.TrackingNumber is { } tracking
                    ? Paragraph($"Номер ТТН: {tracking}")
                    : Block.Empty,
                order.Status == OrderStatus.Shipped && OrderTracking.NovaPoshtaTrackingUrl(order.TrackingNumber) is { } trackingUrl
                    ? Button("Відстежити посилку", trackingUrl)
                    : Block.Empty,
                link is null ? Block.Empty : Button("Переглянути замовлення", link),
            ]);
    }

    public static EmailMessage InquiryForOwner(string to, AdminInquiryDetails inquiry, string link) => Build(
        to,
        $"Нова заявка №{inquiry.Number}: {Topic(inquiry.Topic).ToLower(Uk)}",
        [
            Paragraph($"Від: {inquiry.Name}"),
            Paragraph($"Зв’язок: {Contact(inquiry.PreferredContact)} — {string.Join(", ", new[] { inquiry.Phone is null ? null : Phones.Display(inquiry.Phone), inquiry.Email }.Where(v => v is not null))}"),
            inquiry.ProductName is { } product ? Paragraph($"Товар: {product}") : Block.Empty,
            inquiry.Budget is { } budget ? Paragraph($"Бюджет: {budget}") : Block.Empty,
            Paragraph(inquiry.Message),
            Button("Відкрити в адмін-панелі", link),
        ]);

    public static EmailMessage InquiryReceived(AdminInquiryDetails inquiry) => Build(
        inquiry.Email!,
        $"Заявку №{inquiry.Number} отримано",
        [
            Paragraph($"Вітаємо, {inquiry.Name}!"),
            Paragraph($"Ми отримали вашу заявку №{inquiry.Number}. Майстер зв’яжеться з вами найближчим часом — {Contact(inquiry.PreferredContact).ToLower(Uk)}."),
            Muted("Якщо хочете щось додати, просто дайте відповідь на цей лист або вкажіть номер заявки."),
        ]);

    public static string Topic(InquiryTopic topic) => topic switch
    {
        InquiryTopic.Selection => "Підбір системи",
        InquiryTopic.CustomBuild => "Виготовлення на замовлення",
        InquiryTopic.Product => "Питання про товар",
        InquiryTopic.Service => "Ремонт і обслуговування",
        _ => "Інше",
    };

    private static string Contact(ContactMethod method) => method switch
    {
        ContactMethod.Phone => "Телефоном",
        ContactMethod.Telegram => "У Telegram",
        ContactMethod.Viber => "У Viber",
        ContactMethod.Email => "Електронною поштою",
        _ => method.ToString(),
    };

    public static string Status(OrderStatus status) => status switch
    {
        OrderStatus.New => "Нове",
        OrderStatus.Confirmed => "Підтверджено",
        OrderStatus.Shipped => "Відправлено",
        OrderStatus.Completed => "Виконано",
        OrderStatus.Cancelled => "Скасовано",
        _ => status.ToString(),
    };

    private static string Delivery(OrderDeliveryDto delivery) => delivery.Method switch
    {
        DeliveryMethod.NovaPoshtaWarehouse => $"Нова пошта, відділення — {delivery.City}, {delivery.Warehouse}",
        DeliveryMethod.NovaPoshtaCourier => $"Нова пошта, кур’єр — {delivery.City}, {delivery.Address}",
        DeliveryMethod.Pickup => "самовивіз",
        _ => delivery.Method.ToString(),
    };

    private static string Payment(PaymentMethod method) => method switch
    {
        PaymentMethod.CashOnDelivery => "під час отримання",
        PaymentMethod.BankTransfer => "безготівковий розрахунок",
        _ => method.ToString(),
    };

    private static string Money(decimal value) => value.ToString("N0", Uk) + " ₴";

    // Письмо — последовательность блоков, у каждого текстовый и HTML-вид.
    private sealed record Block(string Text, string Html)
    {
        public static readonly Block Empty = new("", "");
    }

    private static Block Paragraph(string text) =>
        new(text, $"<p style=\"margin:0 0 12px\">{Encode(text)}</p>");

    private static Block Muted(string text) =>
        new(text, $"<p style=\"margin:16px 0 0;color:#71717a;font-size:13px\">{Encode(text)}</p>");

    private static Block Button(string label, string link) => new(
        $"{label}: {link}",
        $"<p style=\"margin:16px 0\"><a href=\"{Encode(link)}\" style=\"display:inline-block;padding:10px 18px;" +
        $"background:#18181b;color:#fbbf24;border-radius:8px;text-decoration:none;font-weight:600\">{Encode(label)}</a></p>");

    private static Block Items(IReadOnlyList<OrderItemDto> items, decimal total)
    {
        var text = new StringBuilder();
        var html = new StringBuilder("<table style=\"width:100%;border-collapse:collapse;margin:0 0 12px\">");
        foreach (var item in items)
        {
            text.AppendLine($"- {item.Name} × {item.Quantity} — {Money(item.LineTotal)}");
            html.Append("<tr>")
                .Append($"<td style=\"padding:6px 0;border-bottom:1px solid #e4e4e7\">{Encode(item.Name)} × {item.Quantity}</td>")
                .Append($"<td style=\"padding:6px 0;border-bottom:1px solid #e4e4e7;text-align:right;white-space:nowrap\">{Encode(Money(item.LineTotal))}</td>")
                .Append("</tr>");
        }

        text.Append($"Разом: {Money(total)}");
        html.Append($"<tr><td style=\"padding:8px 0;font-weight:600\">Разом</td>")
            .Append($"<td style=\"padding:8px 0;font-weight:600;text-align:right\">{Encode(Money(total))}</td></tr></table>");
        return new Block(text.ToString(), html.ToString());
    }

    private static EmailMessage Build(string to, string subject, Block[] blocks)
    {
        var parts = blocks.Where(block => block.Text.Length > 0).ToList();
        var text = string.Join("\n\n", parts.Select(block => block.Text)) + $"\n\n— {Brand}";
        var html =
            "<!doctype html><html><body style=\"margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b\">" +
            "<div style=\"max-width:560px;margin:0 auto;padding:24px\">" +
            $"<p style=\"margin:0 0 16px;font-size:18px;font-weight:700\">{Brand}</p>" +
            "<div style=\"background:#ffffff;border-radius:12px;padding:24px;font-size:15px;line-height:1.5\">" +
            $"<h1 style=\"margin:0 0 16px;font-size:20px\">{Encode(subject)}</h1>" +
            string.Concat(parts.Select(block => block.Html)) +
            "</div></div></body></html>";
        return new EmailMessage(to, $"{subject} — {Brand}", text, html);
    }

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}
