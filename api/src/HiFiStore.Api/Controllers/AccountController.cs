using HiFiStore.Infrastructure;
using HiFiStore.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers;

public sealed record MeResponse(
    Guid Id, string? Email, string? FullName, string? Phone, IReadOnlyList<string> Roles, bool EmailConfirmed);

/// <summary>Имя и телефон покупателя; пустое значение очищает поле. Подставляются при оформлении заказа.</summary>
public sealed record UpdateProfileRequest(string? FullName, string? Phone);

/// <summary>
/// Профиль текущего пользователя. Регистрация, вход и обновление токенов — стандартные
/// эндпоинты ASP.NET Core Identity под <c>/api/auth</c> (см. Program.cs).
/// </summary>
[ApiController]
[Route("api/account")]
[Authorize(AuthenticationSchemes = AuthSchemes.IdentityBearer)]
public sealed class AccountController(UserManager<ApplicationUser> users) : ControllerBase
{
    [HttpGet("me")]
    [ProducesResponseType<MeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MeResponse>> GetMe()
    {
        var user = await users.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(await ToResponseAsync(user));
    }

    [HttpPut("profile")]
    [ProducesResponseType<MeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MeResponse>> UpdateProfile(UpdateProfileRequest request)
    {
        var user = await users.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var errors = new Dictionary<string, string[]>();
        var fullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim();
        if (fullName is { Length: < 2 or > MaxNameLength })
        {
            errors["fullName"] = [$"Имя должно содержать от 2 до {MaxNameLength} символов."];
        }

        string? phone = null;
        if (!string.IsNullOrWhiteSpace(request.Phone))
        {
            phone = Phones.Normalize(request.Phone);
            if (phone is null)
            {
                errors["phone"] = [Phones.InvalidMessage];
            }
        }

        if (errors.Count > 0)
        {
            return ValidationProblem(new ValidationProblemDetails(errors) { Detail = "Проверьте введённые данные." });
        }

        user.FullName = fullName;
        user.PhoneNumber = phone;
        var result = await users.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return Problem("Не удалось сохранить профиль.", statusCode: StatusCodes.Status500InternalServerError);
        }

        return Ok(await ToResponseAsync(user));
    }

    private const int MaxNameLength = 200;

    private async Task<MeResponse> ToResponseAsync(ApplicationUser user)
    {
        var roles = await users.GetRolesAsync(user);
        return new MeResponse(user.Id, user.Email, user.FullName, user.PhoneNumber, roles.ToList(), user.EmailConfirmed);
    }
}
