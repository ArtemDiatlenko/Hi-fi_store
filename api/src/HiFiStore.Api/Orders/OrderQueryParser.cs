using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Orders;

namespace HiFiStore.Api.Orders;

/// <summary>
/// Разбор query-параметров списков заказов: <c>page</c>, <c>pageSize</c> (1..100, по умолчанию 20),
/// для администратора — ещё <c>status</c> и <c>q</c> (номер, телефон, email или имя).
/// </summary>
public static class OrderQueryParser
{
    private const int MaxSearchLength = 200;

    public static bool TryParsePaging(
        IQueryCollection query, out int page, out int pageSize, out Dictionary<string, string[]> errors)
    {
        errors = [];
        (page, pageSize) = Paging.Parse(query, errors);
        return errors.Count == 0;
    }

    public static bool TryParseAdminFilter(
        IQueryCollection query, out AdminOrderFilter filter, out Dictionary<string, string[]> errors)
    {
        TryParsePaging(query, out var page, out var pageSize, out errors);

        OrderStatus? status = null;
        var rawStatus = FirstValue(query, "status");
        if (rawStatus is not null)
        {
            if (EnumNames.TryParse<OrderStatus>(rawStatus, out var parsed))
            {
                status = parsed;
            }
            else
            {
                AddError(errors, "status", $"Неизвестный статус. Допустимые значения: {EnumNames.List<OrderStatus>()}.");
            }
        }

        var search = FirstValue(query, "q");
        if (search is { Length: > MaxSearchLength })
        {
            AddError(errors, "q", $"Строка поиска — не больше {MaxSearchLength} символов.");
        }

        filter = new AdminOrderFilter(status, search, page, pageSize);
        return errors.Count == 0;
    }

    private static string? FirstValue(IQueryCollection query, string name)
    {
        if (!query.TryGetValue(name, out var values))
        {
            return null;
        }

        var value = values.FirstOrDefault();
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static void AddError(Dictionary<string, string[]> errors, string name, string message)
    {
        errors[name] = errors.TryGetValue(name, out var existing)
            ? [.. existing, message]
            : [message];
    }
}
