using System.ComponentModel.DataAnnotations;
using System.Net.Mail;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Api.Cli;

/// <summary>
/// <c>create-admin --email … [--reset-password]</c>: создаёт администратора (email подтверждён, роль Admin)
/// или выдаёт роль Admin существующему пользователю. Пароль нужен для нового пользователя и для
/// <c>--reset-password</c>; он берётся из <see cref="IAdminPasswordSource"/>, а не из аргументов.
/// </summary>
public sealed class CreateAdminCommand(
    StoreDbContext db,
    AdminAccountService accounts,
    IAdminPasswordSource passwords,
    TextWriter output,
    TextWriter error)
{
    public async Task<int> RunAsync(string email, bool resetPassword, CancellationToken ct = default)
    {
        email = email.Trim();
        if (!IsValidEmail(email))
        {
            error.WriteLine($"Некорректный email: «{email}».");
            return ExitCodes.Failure;
        }

        // Без миграций нет ни таблиц, ни ролей: подсказать, что делать, вместо ошибки SQL.
        var pending = (await db.Database.GetPendingMigrationsAsync(ct)).ToList();
        if (pending.Count > 0)
        {
            error.WriteLine(
                $"В базе {StoreCli.Describe(db)} не применены миграции ({pending.Count}): {string.Join(", ", pending)}.");
            error.WriteLine($"Сначала выполните команду {CommandLine.MigrateName}: dotnet HiFiStore.Api.dll {CommandLine.MigrateName}");
            return ExitCodes.Failure;
        }

        var user = await accounts.FindByEmailAsync(email);
        string? password = null;
        if (user is null || resetPassword)
        {
            password = passwords.GetPassword(error);
            if (password is null)
            {
                return ExitCodes.Failure;
            }
        }

        if (user is null)
        {
            var created = await accounts.CreateAsync(email, password!, ct);
            if (!created.Succeeded)
            {
                return Fail($"Не удалось создать администратора {email}:", created);
            }

            output.WriteLine($"Создан администратор {email}: email подтверждён, роль {Roles.Admin}.");
            return ExitCodes.Success;
        }

        var promotion = await accounts.PromoteAsync(user, password, ct);
        if (!promotion.Succeeded)
        {
            return Fail($"Не удалось обновить пользователя {email}:", promotion.Result);
        }

        output.WriteLine(promotion.RoleAdded
            ? $"Пользователю {email} выдана роль {Roles.Admin}. Она попадёт в токен при следующем входе."
            : $"У пользователя {email} уже есть роль {Roles.Admin}.");
        output.WriteLine(promotion.PasswordReset
            ? "Пароль изменён, блокировка входа снята."
            : "Пароль не изменён (чтобы задать новый, добавьте --reset-password).");
        return ExitCodes.Success;
    }

    /// <summary>Адрес в формате, который примет Identity, без имени и угловых скобок («Имя &lt;a@b.c&gt;»).</summary>
    public static bool IsValidEmail(string email) =>
        new EmailAddressAttribute().IsValid(email) &&
        MailAddress.TryCreate(email, out var parsed) &&
        parsed.Address == email;

    private int Fail(string message, IdentityResult result)
    {
        error.WriteLine(message);
        foreach (var identityError in result.Errors)
        {
            error.WriteLine($"  - {identityError.Description}");
        }

        return ExitCodes.Failure;
    }
}
