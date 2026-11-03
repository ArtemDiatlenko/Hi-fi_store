using HiFiStore.Domain.Catalog;

namespace HiFiStore.Infrastructure.Catalog;

public enum CatalogSort
{
    Newest,
    PriceAsc,
    PriceDesc,
    Name,
}

/// <summary>
/// Фильтр по характеристике. Заполняется одно из полей в зависимости от типа фильтра:
/// <list type="bullet">
/// <item><see cref="TextValues"/> — текстовая характеристика, достаточно одного из значений (OR);</item>
/// <item><see cref="Min"/> / <see cref="Max"/> — числовой диапазон;</item>
/// <item><see cref="BoolValue"/> — логическая характеристика.</item>
/// </list>
/// </summary>
public sealed record SpecFilter(
    string Key,
    IReadOnlyList<string>? TextValues = null,
    decimal? Min = null,
    decimal? Max = null,
    bool? BoolValue = null);

/// <summary>
/// Параметры выборки товаров витрины. Все условия объединяются через AND,
/// значения внутри одного условия (бренды, состояния, текстовые характеристики) — через OR.
/// </summary>
public sealed record ProductFilter
{
    /// <summary>Slug раздела. Включает товары всех вложенных разделов.</summary>
    public string? CategorySlug { get; init; }

    public IReadOnlyList<string> BrandSlugs { get; init; } = [];

    public IReadOnlyList<ProductCondition> Conditions { get; init; } = [];

    public decimal? MinPrice { get; init; }

    public decimal? MaxPrice { get; init; }

    public bool InStockOnly { get; init; }

    /// <summary>Поиск по подстроке в названии.</summary>
    public string? Search { get; init; }

    public IReadOnlyList<SpecFilter> Specs { get; init; } = [];

    public CatalogSort Sort { get; init; } = CatalogSort.Newest;

    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = 20;
}
