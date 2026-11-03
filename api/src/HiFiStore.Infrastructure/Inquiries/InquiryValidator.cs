using System.Text.RegularExpressions;
using HiFiStore.Domain.Inquiries;
using HiFiStore.Infrastructure.Orders;

namespace HiFiStore.Infrastructure.Inquiries;

/// <summary>
/// Проверка заявки без обращения к БД. Ключи ошибок — имена полей JSON. Нужен хотя бы один контакт,
/// причём подходящий к выбранному способу связи: для звонка, Telegram и Viber — телефон, для письма — email.
/// </summary>
public static partial class InquiryValidator
{
    public const int MaxNameLength = 200;
    public const int MinMessageLength = 10;
    public const int MaxMessageLength = 3000;
    public const int MaxBudgetLength = 100;
    private const int MaxEmailLength = 254;
    private const int MaxSlugLength = 200;

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();

    public static bool TryValidate(InquiryRequest? request, out ValidatedInquiry? inquiry, out Dictionary<string, string[]> errors)
    {
        errors = [];
        inquiry = null;
        if (request is null)
        {
            CheckoutValidator.AddError(errors, "body", "Передайте тело запроса — JSON-объект.");
            return false;
        }

        if (!EnumNames.TryParse<InquiryTopic>(request.Topic, out var topic))
        {
            CheckoutValidator.AddError(errors, "topic", "Выберите тему обращения.");
        }

        var name = Clean(request.Name);
        if (name is null)
        {
            CheckoutValidator.AddError(errors, "name", "Укажите, как к вам обращаться.");
        }
        else if (name.Length > MaxNameLength)
        {
            CheckoutValidator.AddError(errors, "name", $"Имя — не больше {MaxNameLength} символов.");
        }

        var phone = CheckoutValidator.NormalizePhone(request.Phone);
        if (!string.IsNullOrWhiteSpace(request.Phone) && phone is null)
        {
            CheckoutValidator.AddError(errors, "phone", "Некорректный номер телефона: нужно от 10 до 15 цифр, например +380 67 123 45 67.");
        }

        var email = Clean(request.Email);
        if (email is not null && (email.Length > MaxEmailLength || !EmailPattern().IsMatch(email)))
        {
            CheckoutValidator.AddError(errors, "email", "Некорректный email.");
        }

        if (!EnumNames.TryParse<ContactMethod>(request.PreferredContact, out var contact))
        {
            CheckoutValidator.AddError(errors, "preferredContact", "Выберите способ связи.");
        }
        else if (contact == ContactMethod.Email && email is null && !errors.ContainsKey("email"))
        {
            CheckoutValidator.AddError(errors, "email", "Укажите email — вы выбрали связь по почте.");
        }
        else if (contact != ContactMethod.Email && phone is null && !errors.ContainsKey("phone"))
        {
            CheckoutValidator.AddError(errors, "phone", "Укажите телефон — по нему с вами свяжутся.");
        }

        var message = Clean(request.Message);
        if (message is null || message.Length < MinMessageLength)
        {
            CheckoutValidator.AddError(errors, "message", $"Опишите запрос — хотя бы {MinMessageLength} символов.");
        }
        else if (message.Length > MaxMessageLength)
        {
            CheckoutValidator.AddError(errors, "message", $"Описание — не больше {MaxMessageLength} символов.");
        }

        var budget = Clean(request.Budget);
        if (budget is { Length: > MaxBudgetLength })
        {
            CheckoutValidator.AddError(errors, "budget", $"Бюджет — не больше {MaxBudgetLength} символов.");
        }

        if (!request.Consent)
        {
            CheckoutValidator.AddError(errors, "consent", "Нужно согласие на обработку персональных данных.");
        }

        var slug = Clean(request.ProductSlug);
        if (slug is { Length: > MaxSlugLength })
        {
            slug = null;
        }

        if (errors.Count > 0)
        {
            return false;
        }

        inquiry = new ValidatedInquiry(topic, name!, phone, email, contact, message!, budget, slug);
        return true;
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
