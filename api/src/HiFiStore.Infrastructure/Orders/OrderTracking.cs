using System.Text.RegularExpressions;

namespace HiFiStore.Infrastructure.Orders;

/// <summary>Результат сохранения служебных полей: заказ и признак, что ТТН изменился (повод написать покупателю).</summary>
public sealed record UpdateAdminInfoResult(AdminOrderDetails Order, bool TrackingChanged);

/// <summary>
/// ТТН (номер отправления) и заметка менеджера. ТТН Новой почты — 14 цифр, но магазин может отправлять и другими
/// службами, поэтому допускаются латинские буквы, цифры и дефис; пробелы при вводе убираются.
/// </summary>
public static partial class OrderTracking
{
    public const int MaxTrackingLength = 40;
    public const int MaxNoteLength = 3000;

    [GeneratedRegex("^[A-Za-z0-9-]{4,40}$")]
    private static partial Regex TrackingPattern();

    /// <summary>Номер без пробелов; пустой ввод — <c>null</c>. Ошибка — в <paramref name="errors"/>.</summary>
    public static string? NormalizeTracking(string? raw, Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var value = string.Concat(raw.Where(c => !char.IsWhiteSpace(c))).ToUpperInvariant();
        if (!TrackingPattern().IsMatch(value))
        {
            errors["trackingNumber"] = ["Номер ТТН: от 4 до 40 цифр или латинских букв, например 20450000000000."];
            return null;
        }

        return value;
    }

    public static string? NormalizeNote(string? raw, Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var value = raw.Trim();
        if (value.Length > MaxNoteLength)
        {
            errors["managerNote"] = [$"Не длиннее {MaxNoteLength} символов."];
            return null;
        }

        return value;
    }

    /// <summary>Ссылка на отслеживание Новой почты: только для 14-значного номера.</summary>
    public static string? NovaPoshtaTrackingUrl(string? trackingNumber) =>
        trackingNumber is { Length: 14 } && trackingNumber.All(char.IsAsciiDigit)
            ? $"https://novaposhta.ua/tracking/?cargo_number={trackingNumber}"
            : null;
}
