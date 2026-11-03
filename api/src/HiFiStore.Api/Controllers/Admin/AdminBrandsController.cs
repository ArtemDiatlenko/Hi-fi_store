using HiFiStore.Infrastructure.Catalog.Admin;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers.Admin;

/// <summary>Бренды в админке. Бренд с товарами удалить нельзя (409).</summary>
[Route("api/admin/brands")]
public sealed class AdminBrandsController(IAdminBrandService brands) : AdminControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<AdminBrandDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AdminBrandDto>>> List(CancellationToken ct) =>
        Ok(await brands.ListAsync(ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType<AdminBrandDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        FromResult(await brands.GetAsync(id, ct), Ok);

    [HttpPost]
    [ProducesResponseType<AdminBrandDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(BrandRequest request, CancellationToken ct) =>
        FromResult(await brands.CreateAsync(request, ct), brand => CreatedAtAction(nameof(Get), new { id = brand.Id }, brand));

    [HttpPut("{id:guid}")]
    [ProducesResponseType<AdminBrandDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, BrandRequest request, CancellationToken ct) =>
        FromResult(await brands.UpdateAsync(id, request, ct), Ok);

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        FromResult(await brands.DeleteAsync(id, ct));
}
