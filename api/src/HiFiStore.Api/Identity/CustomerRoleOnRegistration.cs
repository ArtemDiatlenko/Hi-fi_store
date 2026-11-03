using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;

namespace HiFiStore.Api.Identity;

/// <summary>
/// Назначает роль <see cref="Roles.Customer"/> каждому пользователю, зарегистрированному через стандартный
/// эндпоинт Identity <c>POST /register</c> (<c>MapIdentityApi</c>).
/// <para>
/// Это фабрика фильтров для группы эндпоинтов Identity: она оборачивает только эндпоинт, обработчик которого
/// принимает <see cref="RegisterRequest"/>, а остальные (вход, обновление токена и т. д.) не трогает.
/// Сам эндпоинт работает как обычно — те же проверки, ошибки и письмо с подтверждением.
/// </para>
/// <para>
/// Регистрация выполняется в транзакции базы: если назначить роль не удалось, пользователь тоже не сохраняется,
/// и не остаётся учётных записей без роли. Пользователи, созданные иначе (например, администратор из
/// <c>Seed:Admin</c>), роль <c>Customer</c> не получают.
/// </para>
/// </summary>
public static class CustomerRoleOnRegistration
{
    /// <summary>Фабрика для <c>AddEndpointFilterFactory</c> на группе, которую возвращает <c>MapIdentityApi</c>.</summary>
    public static EndpointFilterDelegate Create(EndpointFilterFactoryContext context, EndpointFilterDelegate next)
    {
        var isRegistration = context.MethodInfo.GetParameters().Any(p => p.ParameterType == typeof(RegisterRequest));
        return isRegistration ? invocation => RegisterAsCustomerAsync(invocation, next) : next;
    }

    private static async ValueTask<object?> RegisterAsCustomerAsync(
        EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var services = invocation.HttpContext.RequestServices;
        var db = services.GetRequiredService<StoreDbContext>();

        // UserManager внутри эндпоинта использует тот же scoped StoreDbContext, поэтому его запись попадает в эту транзакцию.
        await using var transaction = await db.Database.BeginTransactionAsync();

        var result = await next(invocation);
        if (!IsSuccess(result))
        {
            // Ошибка валидации: пользователь не создан, транзакция откатится при освобождении.
            return result;
        }

        var registration = invocation.Arguments.OfType<RegisterRequest>().Single();
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByEmailAsync(registration.Email)
            ?? throw new InvalidOperationException("Пользователь не найден сразу после регистрации.");

        var added = await users.AddToRoleAsync(user, Roles.Customer);
        if (!added.Succeeded)
        {
            throw new InvalidOperationException(
                $"Не удалось назначить роль {Roles.Customer}: " + string.Join("; ", added.Errors.Select(e => e.Description)));
        }

        await transaction.CommitAsync();
        return result;
    }

    // Эндпоинт регистрации возвращает Results<Ok, ValidationProblem>: успех — вложенный Ok (200).
    private static bool IsSuccess(object? result) =>
        (result is INestedHttpResult nested ? nested.Result : result)
        is IStatusCodeHttpResult { StatusCode: StatusCodes.Status200OK };
}
