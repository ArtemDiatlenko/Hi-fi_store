using System.Globalization;

namespace HiFiStore.Api;

/// <summary>
/// Постраничный вывод, общий для каталога, админки и заказов: <c>page</c> — от 1 до <see cref="MaxPage"/>,
/// <c>pageSize</c> — от 1 до <see cref="MaxPageSize"/>, по умолчанию <see cref="DefaultPageSize"/>.
/// Пустые значения дают значения по умолчанию.
/// </summary>
public static class Paging
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    /// <summary>
    /// Предел номера страницы: смещение <c>(page - 1) * pageSize</c> должно помещаться в <see cref="int"/>,
    /// иначе оно переполняется и PostgreSQL отвечает ошибкой на отрицательный OFFSET.
    /// </summary>
    public const int MaxPage = int.MaxValue / MaxPageSize;

    /// <summary>Разбирает <c>page</c> и <c>pageSize</c>; ошибки добавляются в <paramref name="errors"/> по именам параметров.</summary>
    public static (int Page, int PageSize) Parse(IQueryCollection query, Dictionary<string, string[]> errors) =>
        (ParseInt(query, "page", 1, MaxPage, errors), ParseInt(query, "pageSize", DefaultPageSize, MaxPageSize, errors));

    private static int ParseInt(
        IQueryCollection query, string name, int defaultValue, int max, Dictionary<string, string[]> errors)
    {
        var value = query.TryGetValue(name, out var values) ? values.FirstOrDefault()?.Trim() : null;
        if (string.IsNullOrEmpty(value))
        {
            return defaultValue;
        }

        if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var result) &&
            result >= 1 && result <= max)
        {
            return result;
        }

        var message = $"Ожидается целое число от 1 до {max}.";
        errors[name] = errors.TryGetValue(name, out var existing) ? [.. existing, message] : [message];
        return defaultValue;
    }
}
