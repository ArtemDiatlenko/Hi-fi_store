using HiFiStore.Api.Orders;
using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers;

public sealed record ChangeOrderStatusRequest(string? Status);

/// <summary>Управление заказами для роли <c>Admin</c>: список с фильтрами, карточка, смена статуса.</summary>
[ApiController]
[Route("api/admin/orders")]
[Authorize(AuthenticationSchemes = AuthSchemes.IdentityBearer, Roles = Roles.Admin)]
public sealed class AdminOrdersController(IOrderService orders) : ControllerBase
{
    /// <summary>Заказы, новые сверху. <c>status</c> — фильтр по статусу, <c>q</c> — номер, телефон, email или имя.</summary>
    [HttpGet]
    [ProducesResponseType<PagedResult<AdminOrderSummary>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!OrderQueryParser.TryParseAdminFilter(Request.Query, out var filter, out var errors))
        {
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        return Ok(await orders.ListForAdminAsync(filter, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<AdminOrderDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminOrderDetails>> Get(Guid id, CancellationToken ct)
    {
        var order = await orders.GetForAdminAsync(id, ct);
        return order is null ? NotFound() : Ok(order);
    }

    /// <summary>
    /// Меняет статус. Разрешённые переходы — в <see cref="OrderWorkflow"/> и в поле <c>nextStatuses</c> карточки.
    /// Отмена возвращает товары на склад.
    /// </summary>
    [HttpPut("{id:guid}/status")]
    [ProducesResponseType<AdminOrderDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeOrderStatusRequest? request, CancellationToken ct)
    {
        if (!EnumNames.TryParse<OrderStatus>(request?.Status, out var status))
        {
            var errors = new Dictionary<string, string[]>
            {
                ["status"] = [$"Укажите статус: {EnumNames.List<OrderStatus>()}."],
            };
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        var result = await orders.ChangeStatusAsync(id, status, ct);
        return result switch
        {
            ChangeStatusResult.Changed changed => Ok(changed.Order),
            ChangeStatusResult.NotFound => NotFound(),
            ChangeStatusResult.NotAllowed notAllowed => Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Такой переход статуса невозможен.",
                detail: $"Заказ в статусе «{OrderLabels.Status(notAllowed.Current)}» нельзя перевести в статус " +
                        $"«{OrderLabels.Status(notAllowed.Requested)}»."),
            _ => throw new InvalidOperationException($"Неизвестный результат смены статуса: {result}"),
        };
    }
}
