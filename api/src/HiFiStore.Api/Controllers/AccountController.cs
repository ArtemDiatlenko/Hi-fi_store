using HiFiStore.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers;

public sealed record MeResponse(Guid Id, string? Email, string? FullName, IReadOnlyList<string> Roles);

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

        var roles = await users.GetRolesAsync(user);
        return Ok(new MeResponse(user.Id, user.Email, user.FullName, roles.ToList()));
    }
}
