using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers.Admin;

/// <summary>
/// Зарегистрированные пользователи: список с поиском, карточка, снятие блокировки входа.
/// Заказы пользователя — <c>GET /api/admin/orders?customerId=…</c>.
/// </summary>
[Route("api/admin/customers")]
public sealed class AdminCustomersController(IAdminCustomerService customers) : AdminControllerBase
{
    private const int MaxSearchLength = 200;

    /// <summary>Параметры: <c>q</c> — часть email или имени, <c>page</c>, <c>pageSize</c>.</summary>
    [HttpGet]
    [ProducesResponseType<PagedResult<AdminCustomerSummary>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var (page, pageSize) = Paging.Parse(Request.Query, errors);
        string? search = Request.Query["q"].FirstOrDefault()?.Trim();
        if (search is { Length: > MaxSearchLength })
        {
            errors["q"] = [$"Строка поиска — не больше {MaxSearchLength} символов."];
        }

        if (errors.Count > 0)
        {
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        return Ok(await customers.ListAsync(new AdminCustomerFilter(search, page, pageSize), ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<AdminCustomerDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminCustomerDetails>> Get(Guid id, CancellationToken ct)
    {
        var customer = await customers.GetAsync(id, ct);
        return customer is null ? NotFound() : Ok(customer);
    }

    /// <summary>Снимает блокировку входа (после нескольких неверных паролей) и обнуляет счётчик попыток.</summary>
    [HttpPost("{id:guid}/unlock")]
    [ProducesResponseType<AdminCustomerDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminCustomerDetails>> Unlock(Guid id, CancellationToken ct)
    {
        var customer = await customers.UnlockAsync(id, ct);
        return customer is null ? NotFound() : Ok(customer);
    }
}
