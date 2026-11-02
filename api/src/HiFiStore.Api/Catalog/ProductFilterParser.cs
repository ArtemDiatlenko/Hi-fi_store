using System.Globalization;
using System.Text.RegularExpressions;
using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Catalog;
using Microsoft.Extensions.Primitives;

namespace HiFiStore.Api.Catalog;

/// <summary>
/// Разбирает query-параметры каталога в <see cref="ProductFilter"/>.
/// <list type="bullet">
/// <item><c>category</c>, <c>brand</c>, <c>condition</c> — slug/значения, несколько через запятую или повторением параметра;</item>
/// <item><c>minPrice</c>, <c>maxPrice</c>, <c>inStock</c>, <c>q</c>;</item>
/// <item><c>sort</c> — <c>newest</c> (по умолчанию), <c>price_asc</c>, <c>price_desc</c>, <c>name</c>;</item>
/// <item><c>page</c>, <c>pageSize</c> (1..100, по умолчанию 20);</item>
/// <item><c>spec.{key}=значение</c> — текстовая характеристика (OR внутри одного ключа);
/// <c>spec.{key}=true|false</c> — логическая; <c>spec.{key}.min</c> / <c>spec.{key}.max</c> — диапазон числа.</item>
/// </list>
/// </summary>
public static class ProductFilterParser
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    private static readonly Regex SpecKeyPattern = new("^[a-z0-9_]{1,64}$", RegexOptions.Compiled);

    public static bool TryParse(IQueryCollection query, out ProductFilter filter, out Dictionary<string, string[]> errors)
    {
        errors = [];

        var conditions = new List<ProductCondition>();
        foreach (var raw in SplitValues(query, "condition"))
        {
            if (Enum.TryParse<ProductCondition>(raw, ignoreCase: true, out var condition) && Enum.IsDefined(condition))
            {
                conditions.Add(condition);
            }
            else
            {
                AddError(errors, "condition", $"Неизвестное состояние товара: {raw}.");
            }
        }

        var minPrice = ParseDecimal(query, "minPrice", errors);
        var maxPrice = ParseDecimal(query, "maxPrice", errors);
        if (minPrice is < 0)
        {
            AddError(errors, "minPrice", "Цена не может быть отрицательной.");
        }

        if (minPrice is { } min && maxPrice is { } max && min > max)
        {
            AddError(errors, "minPrice", "minPrice не может быть больше maxPrice.");
        }

        var page = ParseInt(query, "page", 1, errors, min: 1, max: int.MaxValue);
        var pageSize = ParseInt(query, "pageSize", DefaultPageSize, errors, min: 1, max: MaxPageSize);
        var sort = ParseSort(query, errors);
        var inStock = ParseBool(query, "inStock", errors);
        var specs = ParseSpecs(query, errors);

        filter = new ProductFilter
        {
            CategorySlug = FirstValue(query, "category"),
            BrandSlugs = SplitValues(query, "brand").ToList(),
            Conditions = conditions,
            MinPrice = minPrice,
            MaxPrice = maxPrice,
            InStockOnly = inStock,
            Search = FirstValue(query, "q"),
            Specs = specs,
            Sort = sort,
            Page = page,
            PageSize = pageSize,
        };

        return errors.Count == 0;
    }

    private static List<SpecFilter> ParseSpecs(IQueryCollection query, Dictionary<string, string[]> errors)
    {
        var numericRanges = new Dictionary<string, (decimal? Min, decimal? Max)>();
        var textValues = new Dictionary<string, List<string>>();
        var boolValues = new Dictionary<string, bool>();

        foreach (var (name, values) in query)
        {
            if (!name.StartsWith("spec.", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var rest = name[5..].ToLowerInvariant();
            var dot = rest.LastIndexOf('.');
            var suffix = dot > 0 ? rest[(dot + 1)..] : null;
            var isRange = suffix is "min" or "max";
            var key = isRange ? rest[..dot] : rest;

            if (!SpecKeyPattern.IsMatch(key))
            {
                AddError(errors, name, "Некорректный ключ характеристики.");
                continue;
            }

            var items = values
                .SelectMany(v => (v ?? string.Empty).Split(','))
                .Select(v => v.Trim())
                .Where(v => v.Length > 0)
                .ToList();

            if (isRange)
            {
                if (!decimal.TryParse(items.FirstOrDefault(), NumberStyles.Number, CultureInfo.InvariantCulture, out var bound))
                {
                    AddError(errors, name, "Ожидается число.");
                    continue;
                }

                var (currentMin, currentMax) = numericRanges.GetValueOrDefault(key);
                numericRanges[key] = suffix == "min"
                    ? (bound, currentMax)
                    : (currentMin, bound);
                continue;
            }

            if (items.Count == 0)
            {
                AddError(errors, name, "Укажите значение фильтра.");
                continue;
            }

            if (items.Count == 1 && bool.TryParse(items[0], out var flag))
            {
                boolValues[key] = flag;
                continue;
            }

            textValues[key] = items;
        }

        var result = new List<SpecFilter>();
        foreach (var (key, range) in numericRanges)
        {
            if (range.Min is not null && range.Max is not null && range.Min > range.Max)
            {
                AddError(errors, $"spec.{key}.min", "Минимум не может быть больше максимума.");
                continue;
            }

            result.Add(new SpecFilter(key, Min: range.Min, Max: range.Max));
        }

        result.AddRange(textValues.Select(kv => new SpecFilter(kv.Key, TextValues: kv.Value)));
        result.AddRange(boolValues.Select(kv => new SpecFilter(kv.Key, BoolValue: kv.Value)));

        return result.OrderBy(s => s.Key, StringComparer.Ordinal).ToList();
    }

    private static CatalogSort ParseSort(IQueryCollection query, Dictionary<string, string[]> errors)
    {
        var value = FirstValue(query, "sort");
        switch (value?.ToLowerInvariant())
        {
            case null or "" or "newest":
                return CatalogSort.Newest;
            case "price_asc":
                return CatalogSort.PriceAsc;
            case "price_desc":
                return CatalogSort.PriceDesc;
            case "name":
                return CatalogSort.Name;
            default:
                AddError(errors, "sort", "Допустимые значения: newest, price_asc, price_desc, name.");
                return CatalogSort.Newest;
        }
    }

    private static bool ParseBool(IQueryCollection query, string name, Dictionary<string, string[]> errors)
    {
        var value = FirstValue(query, name);
        if (value is null)
        {
            return false;
        }

        if (bool.TryParse(value, out var result))
        {
            return result;
        }

        AddError(errors, name, "Ожидается true или false.");
        return false;
    }

    private static int ParseInt(
        IQueryCollection query, string name, int defaultValue, Dictionary<string, string[]> errors, int min, int max)
    {
        var value = FirstValue(query, name);
        if (value is null)
        {
            return defaultValue;
        }

        if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var result) &&
            result >= min && result <= max)
        {
            return result;
        }

        AddError(errors, name, $"Ожидается целое число от {min} до {max}.");
        return defaultValue;
    }

    private static decimal? ParseDecimal(IQueryCollection query, string name, Dictionary<string, string[]> errors)
    {
        var value = FirstValue(query, name);
        if (value is null)
        {
            return null;
        }

        if (decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var result))
        {
            return result;
        }

        AddError(errors, name, "Ожидается число.");
        return null;
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

    private static IEnumerable<string> SplitValues(IQueryCollection query, string name)
    {
        if (!query.TryGetValue(name, out var values))
        {
            return [];
        }

        return values
            .SelectMany(v => (v ?? string.Empty).Split(','))
            .Select(v => v.Trim())
            .Where(v => v.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static void AddError(Dictionary<string, string[]> errors, string name, string message)
    {
        errors[name] = errors.TryGetValue(name, out var existing)
            ? [.. existing, message]
            : [message];
    }
}
