using HiFiStore.Api.Catalog;
using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Catalog.Admin;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers.Admin;

/// <summary>
/// Товары в админке, включая неопубликованные. Новый товар создаётся черновиком и появляется на витрине
/// только после <c>POST .../publish</c>.
/// </summary>
[Route("api/admin/products")]
public sealed class AdminProductsController(IAdminProductService products, AdminTranslationService translations) : AdminControllerBase
{
    /// <summary>Параметры: <c>q</c>, <c>categoryId</c>, <c>brandId</c>, <c>published</c>, <c>page</c>, <c>pageSize</c>.</summary>
    [HttpGet]
    [ProducesResponseType<PagedResult<AdminProductListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!AdminProductQueryParser.TryParse(Request.Query, out var query, out var errors))
        {
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        return Ok(await products.ListAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<AdminProductDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        FromResult(await products.GetAsync(id, ct), Ok);

    [HttpPost]
    [ProducesResponseType<AdminProductDetails>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(ProductRequest request, CancellationToken ct) =>
        FromResult(
            await products.CreateAsync(request, ct),
            product => CreatedAtAction(nameof(Get), new { id = product.Id }, product));

    [HttpPut("{id:guid}")]
    [ProducesResponseType<AdminProductDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, ProductRequest request, CancellationToken ct) =>
        FromResult(await products.UpdateAsync(id, request, ct), Ok);

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        FromResult(await products.DeleteAsync(id, ct));

    /// <summary>Заменяет характеристики: <c>{"specs": {"power_w": 80, "bluetooth": true}}</c>.</summary>
    [HttpPut("{id:guid}/specs")]
    [ProducesResponseType<AdminProductDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetSpecs(Guid id, SetProductSpecsRequest request, CancellationToken ct) =>
        FromResult(await products.SetSpecsAsync(id, request, ct), Ok);

    /// <summary>Заменяет изображения: <c>{"images": [{"url": "...", "alt": "..."}]}</c>, порядок сохраняется.</summary>
    [HttpPut("{id:guid}/images")]
    [ProducesResponseType<AdminProductDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetImages(Guid id, SetProductImagesRequest request, CancellationToken ct) =>
        FromResult(await products.SetImagesAsync(id, request, ct), Ok);

    [HttpPost("{id:guid}/publish")]
    [ProducesResponseType<AdminProductDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Publish(Guid id, CancellationToken ct) =>
        FromResult(await products.SetPublishedAsync(id, true, ct), Ok);

    [HttpPost("{id:guid}/unpublish")]
    [ProducesResponseType<AdminProductDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unpublish(Guid id, CancellationToken ct) =>
        FromResult(await products.SetPublishedAsync(id, false, ct), Ok);

    /// <summary>Перевод товара на язык <c>locale</c> (например, <c>en</c>) рядом с основным текстом.</summary>
    [HttpGet("{id:guid}/translations/{locale}")]
    [ProducesResponseType<ProductTranslationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTranslation(Guid id, string locale, CancellationToken ct) =>
        FromResult(await translations.GetProductAsync(id, locale, ct), Ok);

    /// <summary>
    /// Сохраняет перевод названия, описаний и текстовых характеристик. Пустое название удаляет перевод товара,
    /// пустое значение характеристики — её перевод.
    /// </summary>
    [HttpPut("{id:guid}/translations/{locale}")]
    [ProducesResponseType<ProductTranslationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetTranslation(Guid id, string locale, ProductTranslationRequest request, CancellationToken ct) =>
        FromResult(await translations.SetProductAsync(id, locale, request, ct), Ok);
}
