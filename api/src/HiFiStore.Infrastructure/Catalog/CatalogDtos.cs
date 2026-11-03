using HiFiStore.Domain.Catalog;

namespace HiFiStore.Infrastructure.Catalog;

public sealed record BrandRef(string Name, string Slug);

public sealed record CategoryRef(string Name, string Slug);

public sealed record CategoryNode(Guid Id, string Name, string Slug, IReadOnlyList<CategoryNode> Children);

public sealed record ProductListItem(
    Guid Id,
    string Sku,
    string Name,
    string Slug,
    decimal Price,
    decimal? OldPrice,
    bool InStock,
    ProductCondition Condition,
    BrandRef Brand,
    string? ImageUrl);

public sealed record ImageDto(string Url, string? Alt);

public sealed record SpecValueDto(
    string Key,
    string Name,
    string? Unit,
    SpecValueType ValueType,
    object? Value);

public sealed record ProductDetails(
    Guid Id,
    string Sku,
    string Name,
    string Slug,
    string? ShortDescription,
    string Description,
    decimal Price,
    decimal? OldPrice,
    int Stock,
    ProductCondition Condition,
    BrandRef Brand,
    CategoryRef Category,
    IReadOnlyList<ImageDto> Images,
    IReadOnlyList<SpecValueDto> Specs);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

/// <summary>Диапазон или список значений характеристики для построения фильтров на витрине.</summary>
public sealed record SpecFacet(
    string Key,
    string Name,
    string? Unit,
    SpecValueType ValueType,
    decimal? Min,
    decimal? Max,
    IReadOnlyList<string>? Values);

public sealed record CatalogFacets(
    IReadOnlyList<BrandRef> Brands,
    IReadOnlyList<ProductCondition> Conditions,
    decimal? MinPrice,
    decimal? MaxPrice,
    IReadOnlyList<SpecFacet> Specs);
