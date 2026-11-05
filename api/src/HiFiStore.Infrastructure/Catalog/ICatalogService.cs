using HiFiStore.Domain.Catalog;

namespace HiFiStore.Infrastructure.Catalog;

/// <summary>Витрина. <c>locale</c> — язык контента (см. <see cref="ContentLocales"/>); без перевода — основной текст.</summary>
public interface ICatalogService
{
    Task<IReadOnlyList<CategoryNode>> GetCategoryTreeAsync(string locale = ContentLocales.Base, CancellationToken ct = default);

    /// <summary>Возвращает <c>null</c>, если раздел с таким slug не найден.</summary>
    Task<PagedResult<ProductListItem>?> ListProductsAsync(ProductFilter filter, string locale = ContentLocales.Base, CancellationToken ct = default);

    /// <summary>Возвращает <c>null</c>, если опубликованный товар с таким slug не найден.</summary>
    Task<ProductDetails?> GetProductAsync(string slug, string locale = ContentLocales.Base, CancellationToken ct = default);

    /// <summary>Возвращает <c>null</c>, если раздел с таким slug не найден.</summary>
    Task<CatalogFacets?> GetFacetsAsync(string? categorySlug, string locale = ContentLocales.Base, CancellationToken ct = default);
}
