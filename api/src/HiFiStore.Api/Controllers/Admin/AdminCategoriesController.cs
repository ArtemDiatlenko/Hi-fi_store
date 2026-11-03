using HiFiStore.Infrastructure.Catalog.Admin;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers.Admin;

/// <summary>
/// Разделы каталога и их характеристики в админке. Раздел можно перенести под другой родительский раздел
/// (но не в самого себя и не в свой подраздел); раздел с подразделами или товарами удалить нельзя (409).
/// </summary>
[Route("api/admin/categories")]
public sealed class AdminCategoriesController(IAdminCategoryService categories) : AdminControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<AdminCategoryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AdminCategoryDto>>> List(CancellationToken ct) =>
        Ok(await categories.ListAsync(ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType<AdminCategoryDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        FromResult(await categories.GetAsync(id, ct), Ok);

    [HttpPost]
    [ProducesResponseType<AdminCategoryDetails>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CategoryRequest request, CancellationToken ct) =>
        FromResult(
            await categories.CreateAsync(request, ct),
            category => CreatedAtAction(nameof(Get), new { id = category.Id }, category));

    [HttpPut("{id:guid}")]
    [ProducesResponseType<AdminCategoryDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, CategoryRequest request, CancellationToken ct) =>
        FromResult(await categories.UpdateAsync(id, request, ct), Ok);

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        FromResult(await categories.DeleteAsync(id, ct));

    [HttpGet("{id:guid}/specs/{specId:guid}")]
    [ProducesResponseType<AdminSpecDefinitionDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSpec(Guid id, Guid specId, CancellationToken ct) =>
        FromResult(await categories.GetSpecAsync(id, specId, ct), Ok);

    [HttpPost("{id:guid}/specs")]
    [ProducesResponseType<AdminSpecDefinitionDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddSpec(Guid id, SpecDefinitionRequest request, CancellationToken ct) =>
        FromResult(
            await categories.AddSpecAsync(id, request, ct),
            spec => CreatedAtAction(nameof(GetSpec), new { id, specId = spec.Id }, spec));

    [HttpPut("{id:guid}/specs/{specId:guid}")]
    [ProducesResponseType<AdminSpecDefinitionDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateSpec(Guid id, Guid specId, SpecDefinitionRequest request, CancellationToken ct) =>
        FromResult(await categories.UpdateSpecAsync(id, specId, request, ct), Ok);

    [HttpDelete("{id:guid}/specs/{specId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSpec(Guid id, Guid specId, CancellationToken ct) =>
        FromResult(await categories.DeleteSpecAsync(id, specId, ct));
}
