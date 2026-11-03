using HiFiStore.Infrastructure.Email;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Inquiries;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HiFiStore.Api.Controllers;

/// <summary>
/// Заявки на консультацию с витрины: подобрать систему, собрать на заказ, вопрос по товару, сервис.
/// Вход не нужен; с bearer-токеном заявка привязывается к аккаунту. Защита от спама — поле-ловушка
/// <c>website</c> и ограничение частоты (<see cref="InquiryRateLimit"/>).
/// </summary>
[ApiController]
[Route("api/inquiries")]
public sealed class InquiriesController(IInquiryService inquiries, UserManager<ApplicationUser> users, OrderNotifier notifier)
    : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting(InquiryRateLimit.Policy)]
    [ProducesResponseType<InquiryCreated>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] InquiryRequest? request, CancellationToken ct)
    {
        // Ловушка заполнена — это бот. Отвечаем как обычно, чтобы он не подбирал обход, но ничего не сохраняем.
        if (!string.IsNullOrWhiteSpace(request?.Website))
        {
            return StatusCode(StatusCodes.Status201Created, new InquiryCreated(0));
        }

        if (!InquiryValidator.TryValidate(request, out var inquiry, out var errors))
        {
            return ValidationProblem(new ValidationProblemDetails(errors) { Title = "Проверьте данные заявки." });
        }

        // Токен необязателен; просроченный или чужой токен не мешает оставить заявку — она просто без аккаунта.
        Guid? userId = null;
        var auth = await HttpContext.AuthenticateAsync(AuthSchemes.IdentityBearer);
        if (auth.Succeeded && await users.GetUserAsync(auth.Principal) is { } user)
        {
            userId = user.Id;
        }

        var created = await inquiries.CreateAsync(inquiry!, userId, ct);
        notifier.InquiryReceived(created);
        return StatusCode(StatusCodes.Status201Created, new InquiryCreated(created.Number));
    }
}
