using HiFiStore.Infrastructure.Email;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Orders;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers;

/// <summary>
/// Оформление заказа (гостем или после входа) и страница подтверждения по публичному токену.
/// </summary>
[ApiController]
[Route("api/orders")]
public sealed class OrdersController(IOrderService orders, UserManager<ApplicationUser> users, OrderNotifier notifier) : ControllerBase
{
    /// <summary>
    /// Оформляет заказ. Bearer-токен необязателен: с ним заказ привязывается к аккаунту.
    /// Просроченный или неверный токен — 401, чтобы заказ не «потерялся» как гостевой.
    /// </summary>
    [HttpPost]
    [ProducesResponseType<CheckoutResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> PlaceOrder([FromBody] CheckoutRequest? request, CancellationToken ct)
    {
        Guid? userId = null;
        var auth = await HttpContext.AuthenticateAsync(AuthSchemes.IdentityBearer);
        if (auth.Succeeded)
        {
            var user = await users.GetUserAsync(auth.Principal);
            if (user is null)
            {
                return SessionExpired();
            }

            userId = user.Id;
        }
        else if (auth.Failure is not null)
        {
            return SessionExpired();
        }

        if (!CheckoutValidator.TryValidate(request, out var checkout, out var errors))
        {
            return CheckoutValidationProblem(errors);
        }

        var result = await orders.PlaceOrderAsync(checkout!, userId, ct);
        if (result is PlaceOrderResult.Placed placedOrder)
        {
            // Письма покупателю и владельцу уходят в фоне и не влияют на ответ.
            notifier.OrderPlaced(placedOrder.Response);
        }

        return result switch
        {
            PlaceOrderResult.Placed placed => Created(
                $"/api/orders/by-token/{placed.Response.Token}", placed.Response),
            PlaceOrderResult.Invalid invalid => CheckoutValidationProblem(invalid.Errors),
            PlaceOrderResult.OutOfStock outOfStock => OutOfStockProblem(outOfStock.Items),
            _ => throw new InvalidOperationException($"Неизвестный результат оформления: {result}"),
        };
    }

    /// <summary>Заказ по токену из ответа на оформление. Номер заказа для доступа не годится — его легко подобрать.</summary>
    [HttpGet("by-token/{token}")]
    [ProducesResponseType<OrderDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDetails>> GetByToken(string token, CancellationToken ct)
    {
        var order = await orders.GetByTokenAsync(token, ct);
        return order is null ? NotFound() : Ok(order);
    }

    private ActionResult CheckoutValidationProblem(Dictionary<string, string[]> errors) =>
        ValidationProblem(new ValidationProblemDetails(errors) { Title = "Проверьте данные заказа." });

    private ObjectResult OutOfStockProblem(IReadOnlyList<StockShortage> items)
    {
        var detail = "Недостаточно товара на складе: " + string.Join("; ", items.Select(i =>
            $"{(i.Name.Length > 0 ? i.Name : "товар снят с продажи")} — заказано {i.Requested}, доступно {i.Available}")) + ".";

        var problem = ProblemDetailsFactory.CreateProblemDetails(
            HttpContext, StatusCodes.Status409Conflict, title: "Товар закончился.", detail: detail);
        problem.Extensions["items"] = items;
        return new ObjectResult(problem) { StatusCode = StatusCodes.Status409Conflict };
    }

    private ObjectResult SessionExpired() => Problem(
        statusCode: StatusCodes.Status401Unauthorized,
        title: "Сессия истекла.",
        detail: "Войдите снова или оформите заказ без входа.");
}
