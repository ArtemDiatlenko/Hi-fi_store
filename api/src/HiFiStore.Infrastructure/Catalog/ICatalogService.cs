namespace HiFiStore.Infrastructure.Catalog;

public interface ICatalogService
{
    Task<IReadOnlyList<CategoryNode>> GetCategoryTreeAsync(CancellationToken ct = default);

    /// <summary>Возвращает <c>null</c>, если раздел с таким slug не найден.</summary>
    Task<PagedResult<ProductListItem>?> ListProductsAsync(ProductFilter filter, CancellationToken ct = default);

    /// <summary>Возвращает <c>null</c>, если опубликованный товар с таким slug не найден.</summary>
    Task<ProductDetails?> GetProductAsync(string slug, CancellationToken ct = default);

    /// <summary>Возвращает <c>null</c>, если раздел с таким slug не найден.</summary>
    Task<CatalogFacets?> GetFacetsAsync(string? categorySlug, CancellationToken ct = default);
}
