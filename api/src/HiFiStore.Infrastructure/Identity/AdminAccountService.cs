using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;

namespace HiFiStore.Infrastructure.Identity;

/// <summary>Итог <see cref="AdminAccountService.PromoteAsync"/>.</summary>
public sealed record AdminPromotion(IdentityResult Result, bool RoleAdded, bool PasswordReset)
{
    public bool Succeeded => Result.Succeeded;

    public static AdminPromotion Failed(IdentityResult result) => new(result, RoleAdded: false, PasswordReset: false);
}

/// <summary>
/// Учётные записи администраторов: создание и выдача роли <see cref="Roles.Admin"/>. Используется командой
/// <c>create-admin</c> и инициализатором базы (<c>Seed:Admin</c>). Каждая операция выполняется в транзакции:
/// при ошибке не остаётся ни пользователя без роли, ни пользователя без пароля.
/// </summary>
public sealed class AdminAccountService(StoreDbContext db, UserManager<ApplicationUser> users)
{
    public const string DefaultFullName = "Адміністратор";

    public Task<ApplicationUser?> FindByEmailAsync(string email) => users.FindByEmailAsync(email);

    public Task<bool> CheckPasswordAsync(ApplicationUser user, string password) => users.CheckPasswordAsync(user, password);

    /// <summary>
    /// Создаёт пользователя с подтверждённым email и ролью <see cref="Roles.Admin"/>. Пароль проверяется
    /// правилами Identity; при ошибке возвращаются её описания, а пользователь не создаётся.
    /// </summary>
    public async Task<IdentityResult> CreateAsync(string email, string password, CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var admin = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FullName = DefaultFullName,
        };

        var created = await users.CreateAsync(admin, password);
        if (!created.Succeeded)
        {
            return created;
        }

        var roleAdded = await users.AddToRoleAsync(admin, Roles.Admin);
        if (!roleAdded.Succeeded)
        {
            return roleAdded;
        }

        await transaction.CommitAsync(ct);
        return IdentityResult.Success;
    }

    /// <summary>
    /// Выдаёт существующему пользователю роль <see cref="Roles.Admin"/>, если её ещё нет. Если передан
    /// <paramref name="newPassword"/>, ещё и меняет пароль и снимает блокировку входа после неудачных попыток.
    /// </summary>
    public async Task<AdminPromotion> PromoteAsync(ApplicationUser user, string? newPassword, CancellationToken ct = default)
    {
        if (newPassword is not null)
        {
            // Проверить пароль до любых изменений, чтобы слабый пароль не стоил ни роли, ни прежнего пароля.
            var validation = await ValidatePasswordAsync(user, newPassword);
            if (!validation.Succeeded)
            {
                return AdminPromotion.Failed(validation);
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var roleAdded = false;
        if (!await users.IsInRoleAsync(user, Roles.Admin))
        {
            var added = await users.AddToRoleAsync(user, Roles.Admin);
            if (!added.Succeeded)
            {
                return AdminPromotion.Failed(added);
            }

            roleAdded = true;
        }

        if (newPassword is not null)
        {
            var reset = await SetPasswordAsync(user, newPassword);
            if (!reset.Succeeded)
            {
                return AdminPromotion.Failed(reset);
            }
        }

        await transaction.CommitAsync(ct);
        return new AdminPromotion(IdentityResult.Success, roleAdded, PasswordReset: newPassword is not null);
    }

    private async Task<IdentityResult> ValidatePasswordAsync(ApplicationUser user, string password)
    {
        var errors = new List<IdentityError>();
        foreach (var validator in users.PasswordValidators)
        {
            var result = await validator.ValidateAsync(users, user, password);
            errors.AddRange(result.Errors);
        }

        return errors.Count == 0 ? IdentityResult.Success : IdentityResult.Failed([.. errors]);
    }

    private async Task<IdentityResult> SetPasswordAsync(ApplicationUser user, string password)
    {
        if (await users.HasPasswordAsync(user))
        {
            var removed = await users.RemovePasswordAsync(user);
            if (!removed.Succeeded)
            {
                return removed;
            }
        }

        var added = await users.AddPasswordAsync(user, password);
        if (!added.Succeeded)
        {
            return added;
        }

        var unlocked = await users.SetLockoutEndDateAsync(user, null);
        return unlocked.Succeeded ? await users.ResetAccessFailedCountAsync(user) : unlocked;
    }
}
