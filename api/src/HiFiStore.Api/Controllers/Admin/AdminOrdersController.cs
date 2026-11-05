using HiFiStore.Api.Orders;
using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Email;
using HiFiStore.Infrastructure.Orders;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers.Admin;

/// <param name="TrackingNumber">ТТН — передаётся при переводе в «Отправлен» (необязателен).</param>
public sealed record ChangeOrderStatusRequest(string? Status, string? TrackingNumber = null);

/// <summary>
/// Управление заказами для роли <c>Admin</c>: список с фильтрами, карточка, смена статуса.
/// Доступ и формат ошибок разбора запроса — общие для админки, см. <see cref="AdminControllerBase"/>.
/// </summary>
[Route("api/admin/orders")]
public sealed class AdminOrdersController(IOrderService orders, OrderNotifier notifier) : AdminControllerBase
{
    /// <summary>Заказы, новые сверху. <c>status</c> — фильтр по статусу, <c>q</c> — номер, телефон, email или имя.</summary>
    [HttpGet]
    [ProducesResponseType<PagedResult<AdminOrderSummary>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
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

        var trackingErrors = new Dictionary<string, string[]>();
        var tracking = status == OrderStatus.Shipped ? OrderTracking.NormalizeTracking(request?.TrackingNumber, trackingErrors) : null;
        if (trackingErrors.Count > 0)
        {
            return ValidationProblem(new ValidationProblemDetails(trackingErrors));
        }

        var result = await orders.ChangeStatusAsync(id, status, tracking, ct);
        if (result is ChangeStatusResult.Changed changedOrder)
        {
            // Письмо покупателю о новом статусе — в фоне.
            notifier.StatusChanged(changedOrder.Order);
        }

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

    /// <summary>
    /// ТТН и заметка менеджера. Если у отправленного заказа появился или поменялся ТТН, покупатель получит письмо.
    /// </summary>
    [HttpPut("{id:guid}/info")]
    [ProducesResponseType<AdminOrderDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateInfo(Guid id, OrderAdminInfoRequest request, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var tracking = OrderTracking.NormalizeTracking(request.TrackingNumber, errors);
        var note = OrderTracking.NormalizeNote(request.ManagerNote, errors);
        if (errors.Count > 0)
        {
            return ValidationProblem(new ValidationProblemDetails(errors) { Detail = "Проверьте введённые данные." });
        }

        var result = await orders.UpdateAdminInfoAsync(id, tracking, note, ct);
        if (result is null)
        {
            return NotFound();
        }

        if (result.TrackingChanged && result.Order.Status == OrderStatus.Shipped && result.Order.TrackingNumber is not null)
        {
            notifier.StatusChanged(result.Order);
        }

        return Ok(result.Order);
    }
}
