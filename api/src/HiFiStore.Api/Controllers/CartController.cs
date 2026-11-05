using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Orders;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers;

/// <summary>
/// Корзина хранится на клиенте (только id товаров и количество). Этот эндпоинт пересчитывает её
/// по каталогу: актуальные цены, наличие и итог — витрина не доверяет сохранённым у себя ценам.
/// </summary>
[ApiController]
[Route("api/cart")]
public sealed class CartController(IOrderService orders) : ControllerBase
{
    [HttpPost("quote")]
    [ProducesResponseType<CartQuote>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CartQuote>> Quote([FromBody] CartQuoteRequest? request, [FromQuery] string? lang, CancellationToken ct)
    {
        if (request?.Items is null || request.Items.Count == 0)
        {
            return Ok(new CartQuote([], 0, 0m, false));
        }

        var errors = new Dictionary<string, string[]>();
        var lines = CheckoutValidator.ValidateLines(request.Items, errors);
        if (errors.Count > 0)
        {
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        return Ok(await orders.QuoteAsync(lines, ContentLocales.Resolve(lang), ct));
    }
}
