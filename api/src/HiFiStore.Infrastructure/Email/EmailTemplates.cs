using System.Globalization;
using System.Net;
using System.Text;
using HiFiStore.Domain.Inquiries;
using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Inquiries;
using HiFiStore.Infrastructure.Orders;

namespace HiFiStore.Infrastructure.Email;

/// <summary>
/// Тексты писем. Покупателю — на языке витрины, где он оформил заказ или заявку (<c>uk</c> или <c>en</c>);
/// владельцу магазина — всегда на украинском.
/// Каждое письмо собирается в двух видах: обычный текст (для почтовиков без HTML и для лога) и простой HTML.
/// </summary>
public static class EmailTemplates
{
    private const string Brand = "Hi-Fi Store";
    private static readonly CultureInfo Uk = CultureInfo.GetCultureInfo("uk-UA");

    private static bool En(string locale) => locale == "en";

    public static EmailMessage ConfirmEmail(string to, string link, string locale = "uk") => En(locale)
        ? Build(
            to,
            "Confirm your email",
            [
                Paragraph("Thank you for signing up at Hi-Fi Store!"),
                Paragraph("To confirm your email address, follow the link:"),
                Button("Confirm email", link),
                Muted("If you did not sign up, just ignore this email."),
            ])
        : Build(
            to,
            "Підтвердіть email",
            [
                Paragraph("Дякуємо за реєстрацію в Hi-Fi Store!"),
                Paragraph("Щоб підтвердити адресу електронної пошти, перейдіть за посиланням:"),
                Button("Підтвердити email", link),
                Muted("Якщо ви не реєструвалися, просто проігноруйте цей лист."),
            ]);

    public static EmailMessage ResetPassword(string to, string link, string locale = "uk") => En(locale)
        ? Build(
            to,
            "Password reset",
            [
                Paragraph("You (or someone else) asked to reset the password for your Hi-Fi Store account."),
                Paragraph("To set a new password, follow the link:"),
                Button("Set a new password", link),
                Muted("If you did not ask to reset your password, ignore this email — your password will not change."),
            ])
        : Build(
            to,
            "Відновлення пароля",
            [
                Paragraph("Ви (або хтось інший) попросили відновити пароль до акаунта в Hi-Fi Store."),
                Paragraph("Щоб задати новий пароль, перейдіть за посиланням:"),
                Button("Задати новий пароль", link),
                Muted("Якщо ви не просили відновити пароль, проігноруйте цей лист — пароль не зміниться."),
            ]);

    public static EmailMessage OrderPlaced(OrderDetails order, string link) => En(order.Locale)
        ? Build(
            order.Customer.Email,
            $"Order #{order.Number} received",
            [
                Paragraph($"Hello, {order.Customer.FullName}!"),
                Paragraph($"We have received your order #{order.Number}. A manager will contact you to confirm availability and delivery."),
                Items(order.Items, order.Total, "en"),
                Paragraph($"Delivery: {Delivery(order.Delivery, "en")}"),
                Paragraph($"Payment: {Payment(order.PaymentMethod, "en")}"),
                Button("View order", link),
            ])
        : Build(
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
        var en = En(order.Locale);
        var text = order.Status switch
        {
            OrderStatus.Confirmed => en ? "has been confirmed. We are getting it ready to ship." : "підтверджено. Готуємо його до відправлення.",
            OrderStatus.Shipped => en ? "has been handed over to the carrier." : "передано в службу доставки.",
            OrderStatus.Completed => en ? "is complete. Thank you for your purchase!" : "виконано. Дякуємо за покупку!",
            OrderStatus.Cancelled => en ? "has been cancelled. If this is a mistake, please contact us." : "скасовано. Якщо це помилка, зв’яжіться з нами.",
            _ => null,
        };
        if (text is null)
        {
            return null;
        }

        return Build(
            order.Customer.Email,
            en
                ? $"Order #{order.Number}: {Status(order.Status, "en").ToLowerInvariant()}"
                : $"Замовлення №{order.Number}: {Status(order.Status).ToLower(Uk)}",
            [
                Paragraph(en ? $"Hello, {order.Customer.FullName}!" : $"Вітаємо, {order.Customer.FullName}!"),
                Paragraph(en ? $"Your order #{order.Number} {text}" : $"Ваше замовлення №{order.Number} {text}"),
                order.Status == OrderStatus.Shipped && order.TrackingNumber is { } tracking
                    ? Paragraph(en ? $"Tracking number: {tracking}" : $"Номер ТТН: {tracking}")
                    : Block.Empty,
                order.Status == OrderStatus.Shipped && OrderTracking.NovaPoshtaTrackingUrl(order.TrackingNumber) is { } trackingUrl
                    ? Button(en ? "Track the parcel" : "Відстежити посилку", trackingUrl)
                    : Block.Empty,
                link is null ? Block.Empty : Button(en ? "View order" : "Переглянути замовлення", link),
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

    public static EmailMessage InquiryReceived(AdminInquiryDetails inquiry, string locale = "uk") => En(locale)
        ? Build(
            inquiry.Email!,
            $"Request #{inquiry.Number} received",
            [
                Paragraph($"Hello, {inquiry.Name}!"),
                Paragraph($"We have received your request #{inquiry.Number}. The maker will get in touch soon — {ContactEn(inquiry.PreferredContact)}."),
                Muted("If you want to add something, just reply to this email or mention the request number."),
            ])
        : Build(
            inquiry.Email!,
            $"Заявку №{inquiry.Number} отримано",
            [
                Paragraph($"Вітаємо, {inquiry.Name}!"),
                Paragraph($"Ми отримали вашу заявку №{inquiry.Number}. Майстер зв’яжеться з вами найближчим часом — {Contact(inquiry.PreferredContact).ToLower(Uk)}."),
                Muted("Якщо хочете щось додати, просто дайте відповідь на цей лист або вкажіть номер заявки."),
            ]);

    private static string ContactEn(ContactMethod method) => method switch
    {
        ContactMethod.Phone => "by phone",
        ContactMethod.Telegram => "on Telegram",
        ContactMethod.Viber => "on Viber",
        ContactMethod.Email => "by email",
        _ => method.ToString(),
    };

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

    public static string Status(OrderStatus status, string locale) => !En(locale) ? Status(status) : status switch
    {
        OrderStatus.New => "New",
        OrderStatus.Confirmed => "Confirmed",
        OrderStatus.Shipped => "Shipped",
        OrderStatus.Completed => "Completed",
        OrderStatus.Cancelled => "Cancelled",
        _ => status.ToString(),
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

    private static string Delivery(OrderDeliveryDto delivery, string locale) => !En(locale) ? Delivery(delivery) : delivery.Method switch
    {
        DeliveryMethod.NovaPoshtaWarehouse => $"Nova Poshta, branch — {delivery.City}, {delivery.Warehouse}",
        DeliveryMethod.NovaPoshtaCourier => $"Nova Poshta, courier — {delivery.City}, {delivery.Address}",
        DeliveryMethod.Pickup => "pickup from the store",
        _ => delivery.Method.ToString(),
    };

    private static string Delivery(OrderDeliveryDto delivery) => delivery.Method switch
    {
        DeliveryMethod.NovaPoshtaWarehouse => $"Нова пошта, відділення — {delivery.City}, {delivery.Warehouse}",
        DeliveryMethod.NovaPoshtaCourier => $"Нова пошта, кур’єр — {delivery.City}, {delivery.Address}",
        DeliveryMethod.Pickup => "самовивіз",
        _ => delivery.Method.ToString(),
    };

    private static string Payment(PaymentMethod method, string locale) => !En(locale) ? Payment(method) : method switch
    {
        PaymentMethod.CashOnDelivery => "on delivery",
        PaymentMethod.BankTransfer => "bank transfer",
        _ => method.ToString(),
    };

    private static string Payment(PaymentMethod method) => method switch
    {
        PaymentMethod.CashOnDelivery => "під час отримання",
        PaymentMethod.BankTransfer => "безготівковий розрахунок",
        _ => method.ToString(),
    };

    private static string Money(decimal value) => value.ToString("N0", Uk) + " ₴";

    /// <summary>Как на витрине: «58 900 ₴» по-украински, «₴58,900» по-английски.</summary>
    private static string Money(decimal value, string locale) =>
        En(locale) ? "₴" + value.ToString("N0", CultureInfo.InvariantCulture) : Money(value);

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

    private static Block Items(IReadOnlyList<OrderItemDto> items, decimal total, string locale = "uk")
    {
        var totalLabel = En(locale) ? "Total" : "Разом";
        var text = new StringBuilder();
        var html = new StringBuilder("<table style=\"width:100%;border-collapse:collapse;margin:0 0 12px\">");
        foreach (var item in items)
        {
            text.AppendLine($"- {item.Name} × {item.Quantity} — {Money(item.LineTotal, locale)}");
            html.Append("<tr>")
                .Append($"<td style=\"padding:6px 0;border-bottom:1px solid #e4e4e7\">{Encode(item.Name)} × {item.Quantity}</td>")
                .Append($"<td style=\"padding:6px 0;border-bottom:1px solid #e4e4e7;text-align:right;white-space:nowrap\">{Encode(Money(item.LineTotal, locale))}</td>")
                .Append("</tr>");
        }

        text.Append($"{totalLabel}: {Money(total, locale)}");
        html.Append($"<tr><td style=\"padding:8px 0;font-weight:600\">{totalLabel}</td>")
            .Append($"<td style=\"padding:8px 0;font-weight:600;text-align:right\">{Encode(Money(total, locale))}</td></tr></table>");
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
