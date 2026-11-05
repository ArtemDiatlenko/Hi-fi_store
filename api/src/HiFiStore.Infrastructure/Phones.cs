using PhoneNumbers;

namespace HiFiStore.Infrastructure;

/// <summary>
/// Телефоны в международном формате E.164 (<c>+380671234567</c>). Номер обязан начинаться с «+» и кода страны:
/// магазин не угадывает страну. Длина и формат проверяются по правилам страны (libphonenumber), поэтому
/// опечатка в одну цифру не проходит. Витрина отправляет номер уже с кодом страны из выпадающего списка.
/// </summary>
public static class Phones
{
    public const string InvalidMessage = "Укажите номер с кодом страны, например +380 67 123 45 67.";

    private static readonly PhoneNumberUtil Util = PhoneNumberUtil.GetInstance();

    /// <summary>Номер в формате E.164 или null, если номер пустой или некорректный.</summary>
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var value = raw.Trim();
        if (!value.StartsWith('+'))
        {
            return null;
        }

        try
        {
            var number = Util.Parse(value, null);
            return Util.IsValidNumber(number) ? Util.Format(number, PhoneNumberFormat.E164) : null;
        }
        catch (NumberParseException)
        {
            return null;
        }
    }

    /// <summary>Номер для людей (письма): «+380 67 123 4567». Старый номер без кода страны — как есть.</summary>
    public static string Display(string phone)
    {
        if (!phone.StartsWith('+'))
        {
            return phone;
        }

        try
        {
            var number = Util.Parse(phone, null);
            return Util.IsValidNumber(number) ? Util.Format(number, PhoneNumberFormat.INTERNATIONAL) : phone;
        }
        catch (NumberParseException)
        {
            return phone;
        }
    }

    /// <summary>
    /// Цифры для поиска по телефону без ведущих нулей: «067 123 45 67» находит «+380671234567»,
    /// а «+380 67…» — тоже. Пусто, если в строке меньше трёх цифр.
    /// </summary>
    public static string SearchDigits(string term)
    {
        var digits = new string(term.Where(char.IsAsciiDigit).ToArray()).TrimStart('0');
        return digits.Length >= 3 ? digits : "";
    }
}
