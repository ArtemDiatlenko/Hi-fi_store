using HiFiStore.Api.Catalog;
using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Catalog;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers;

/// <summary>Публичный каталог: разделы, товары, фасеты для фильтров. Доступен без авторизации.</summary>
[ApiController]
[Route("api/catalog")]
// Параметр lang (например, lang=en) — язык контента; без перевода отдаётся основной (украинский) текст.
public sealed class CatalogController(ICatalogService catalog) : ControllerBase
{
    [HttpGet("categories")]
    [ProducesResponseType<IReadOnlyList<CategoryNode>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategoryNode>>> GetCategories([FromQuery] string? lang, CancellationToken ct) =>
        Ok(await catalog.GetCategoryTreeAsync(ContentLocales.Resolve(lang), ct));

    [HttpGet("products")]
    [ProducesResponseType<PagedResult<ProductListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProducts([FromQuery] string? lang, CancellationToken ct)
    {
        if (!ProductFilterParser.TryParse(Request.Query, out var filter, out var errors))
        {
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        var result = await catalog.ListProductsAsync(filter, ContentLocales.Resolve(lang), ct);
        return result is null
            ? Problem("Раздел не найден.", statusCode: StatusCodes.Status404NotFound)
            : Ok(result);
    }

    [HttpGet("products/{slug}")]
    [ProducesResponseType<ProductDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDetails>> GetProduct(string slug, [FromQuery] string? lang, CancellationToken ct)
    {
        var product = await catalog.GetProductAsync(slug, ContentLocales.Resolve(lang), ct);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("facets")]
    [ProducesResponseType<CatalogFacets>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CatalogFacets>> GetFacets([FromQuery] string? category, [FromQuery] string? lang, CancellationToken ct)
    {
        var facets = await catalog.GetFacetsAsync(string.IsNullOrWhiteSpace(category) ? null : category, ContentLocales.Resolve(lang), ct);
        return facets is null ? NotFound() : Ok(facets);
    }
}
