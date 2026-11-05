using HiFiStore.Domain.Catalog;
using HiFiStore.Api.Orders;
using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers;

/// <summary>Заказы текущего покупателя. Чужой заказ отдаёт 404, а не 403, чтобы не раскрывать его существование.</summary>
[ApiController]
[Route("api/account/orders")]
[Authorize(AuthenticationSchemes = AuthSchemes.IdentityBearer)]
public sealed class AccountOrdersController(IOrderService orders, UserManager<ApplicationUser> users) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<PagedResult<OrderSummary>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (CurrentUserId() is not { } userId)
        {
            return Unauthorized();
        }

        if (!OrderQueryParser.TryParsePaging(Request.Query, out var page, out var pageSize, out var errors))
        {
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        return Ok(await orders.ListForUserAsync(userId, page, pageSize, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<OrderDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDetails>> Get(Guid id, [FromQuery] string? lang, CancellationToken ct)
    {
        if (CurrentUserId() is not { } userId)
        {
            return Unauthorized();
        }

        var order = await orders.GetForUserAsync(userId, id, ContentLocales.Resolve(lang), ct);
        return order is null ? NotFound() : Ok(order);
    }

    private Guid? CurrentUserId() =>
        Guid.TryParse(users.GetUserId(User), out var id) ? id : null;
}
