using HiFiStore.Infrastructure.Catalog.Admin;

namespace HiFiStore.Api.Catalog;

/// <summary>
/// Разбирает query-параметры списка товаров в админке в <see cref="AdminProductQuery"/>:
/// <c>q</c> — поиск по названию и артикулу; <c>categoryId</c> — раздел вместе с вложенными; <c>brandId</c>;
/// <c>published</c> — <c>true</c>/<c>false</c>; <c>page</c>, <c>pageSize</c> (1..100, по умолчанию 20).
/// Пустые значения игнорируются.
/// </summary>
public static class AdminProductQueryParser
{
    public static bool TryParse(IQueryCollection query, out AdminProductQuery result, out Dictionary<string, string[]> errors)
    {
        errors = [];

        var (page, pageSize) = Paging.Parse(query, errors);
        result = new AdminProductQuery
        {
            Search = FirstValue(query, "q"),
            CategoryId = ParseGuid(query, "categoryId", errors),
            BrandId = ParseGuid(query, "brandId", errors),
            IsPublished = ParseBool(query, "published", errors),
            Page = page,
            PageSize = pageSize,
        };

        return errors.Count == 0;
    }

    private static Guid? ParseGuid(IQueryCollection query, string name, Dictionary<string, string[]> errors)
    {
        var value = FirstValue(query, name);
        if (value is null)
        {
            return null;
        }

        if (Guid.TryParse(value, out var result))
        {
            return result;
        }

        errors[name] = ["Ожидается идентификатор (GUID)."];
        return null;
    }

    private static bool? ParseBool(IQueryCollection query, string name, Dictionary<string, string[]> errors)
    {
        var value = FirstValue(query, name);
        if (value is null)
        {
            return null;
        }

        if (bool.TryParse(value, out var result))
        {
            return result;
        }

        errors[name] = ["Ожидается true или false."];
        return null;
    }

    private static string? FirstValue(IQueryCollection query, string name)
    {
        var value = query.TryGetValue(name, out var values) ? values.FirstOrDefault() : null;
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
