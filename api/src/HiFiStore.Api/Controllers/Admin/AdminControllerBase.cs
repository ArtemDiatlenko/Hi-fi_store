using HiFiStore.Infrastructure.Catalog.Admin;
using HiFiStore.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HiFiStore.Api.Controllers.Admin;

/// <summary>
/// Основа административных контроллеров (<c>/api/admin/...</c>): доступ только по bearer-токену Identity
/// и только с ролью <see cref="Roles.Admin"/>. Без токена — 401, с токеном без роли — 403.
/// Переводит результаты сервисов в HTTP: 400 (<see cref="ValidationProblemDetails"/>), 404, 409.
/// </summary>
[ApiController]
[Authorize(AuthenticationSchemes = AuthSchemes.IdentityBearer, Roles = Roles.Admin)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public abstract class AdminControllerBase : ControllerBase, IActionFilter
{
    private const string BodyField = "body";

    /// <summary>
    /// Ошибки разбора тела запроса (некорректный JSON, значение не того типа) MVC отклоняет ещё до вызова сервиса,
    /// с английскими сообщениями и ключами вида <c>$.price</c>. Контроллер-фильтр выполняется раньше
    /// стандартной проверки <c>[ApiController]</c> и отвечает в том же формате, что и сервисы.
    /// </summary>
    [NonAction]
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (context.ModelState.IsValid)
        {
            return;
        }

        var parameterNames = context.ActionDescriptor.Parameters.Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var (key, entry) in context.ModelState)
        {
            if (entry.Errors.Count == 0)
            {
                continue;
            }

            if (key.StartsWith("$.", StringComparison.Ordinal))
            {
                errors[key[2..]] = ["Некорректное значение: проверьте тип и формат поля."];
            }
            else if (key is "" or "$" || parameterNames.Contains(key))
            {
                errors[BodyField] = ["Передайте тело запроса — JSON-объект."];
            }
            else
            {
                errors[key] = ["Некорректное значение."];
            }
        }

        // Ошибка «тело не задано» сопровождает любую ошибку разбора — оставляем её, только если других нет.
        if (errors.Count > 1)
        {
            errors.Remove(BodyField);
        }

        context.Result = ValidationProblem(new ValidationProblemDetails(errors) { Detail = "Проверьте введённые данные." });
    }

    [NonAction]
    public void OnActionExecuted(ActionExecutedContext context)
    {
    }

    protected IActionResult FromResult<T>(AdminResult<T> result, Func<T, IActionResult> onSuccess) =>
        result.Error is { } error ? FromError(error) : onSuccess(result.Value!);

    protected IActionResult FromResult(AdminResult result) =>
        result.Error is { } error ? FromError(error) : NoContent();

    private IActionResult FromError(AdminError error) => error.Kind switch
    {
        AdminErrorKind.Validation => ValidationProblem(
            new ValidationProblemDetails(error.Errors?.ToDictionary(e => e.Key, e => e.Value) ?? [])
            {
                Detail = error.Message,
            }),
        AdminErrorKind.NotFound => Problem(error.Message, statusCode: StatusCodes.Status404NotFound),
        AdminErrorKind.Conflict => Problem(error.Message, statusCode: StatusCodes.Status409Conflict),
        _ => throw new ArgumentOutOfRangeException(nameof(error), error.Kind, "Неизвестный вид ошибки."),
    };
}
