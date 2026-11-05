using HiFiStore.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Infrastructure.Persistence.Seeding;

/// <summary>
/// Приводит базу в рабочее состояние: применяет миграции, создаёт роли,
/// при наличии настроек — учётную запись администратора и демо-каталог.
/// </summary>
public static class StoreDbInitializer
{
    /// <summary>
    /// Настройки:
    /// <list type="bullet">
    /// <item><c>Seed:Admin:Email</c> и <c>Seed:Admin:Password</c> — создать администратора, если его ещё нет.
    /// Пароль задавайте через user-secrets или переменные окружения, а не в appsettings.</item>
    /// <item><c>Seed:Admin:ResetPassword</c> — если администратор уже есть, сменить ему пароль на <c>Seed:Admin:Password</c>
    /// (и снять блокировку входа), когда пароли не совпадают. Для восстановления доступа без команды create-admin.</item>
    /// <item><c>Store:DemoCatalog</c> — заполнить каталог тестовыми данными, если товаров ещё нет; в уже заполненном
    /// каталоге — заменить у демо-товаров старые заглушки placehold.co иллюстрациями.</item>
    /// </list>
    /// </summary>
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration configuration, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;

        var db = provider.GetRequiredService<StoreDbContext>();
        await db.Database.MigrateAsync(ct);

        await EnsureRolesAsync(provider.GetRequiredService<RoleManager<IdentityRole<Guid>>>());
        await EnsureAdminAsync(provider.GetRequiredService<AdminAccountService>(), configuration, ct);

        if (configuration.GetValue<bool>("Store:DemoCatalog"))
        {
            if (!await db.Products.AnyAsync(ct))
            {
                await DemoCatalog.SeedAsync(db, ct);
            }
            else
            {
                // Уже заполненный демо-каталог: заменить старые заглушки placehold.co иллюстрациями.
                await DemoCatalog.UpgradeLegacyImagesAsync(db, ct);
            }

            // Английский перевод демо-товаров и разделов — и для новой, и для уже заполненной базы.
            await DemoCatalogEnglish.ApplyAsync(db, ct);
        }
    }

    private static async Task EnsureRolesAsync(RoleManager<IdentityRole<Guid>> roles)
    {
        // Только подстраховка: роли создаёт миграция SeedIdentityRoles. Поиск идёт по имени, поэтому
        // созданные миграцией роли здесь не пересоздаются.
        foreach (var role in Roles.All)
        {
            if (!await roles.RoleExistsAsync(role))
            {
                await roles.CreateAsync(new IdentityRole<Guid>(role) { Id = Guid.NewGuid() });
            }
        }
    }

    private static async Task EnsureAdminAsync(AdminAccountService accounts, IConfiguration configuration, CancellationToken ct)
    {
        var email = configuration["Seed:Admin:Email"];
        var password = configuration["Seed:Admin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        // Существующего пользователя по умолчанию не трогаем: выдать роль или сменить пароль — дело команды create-admin.
        // Исключение — Seed:Admin:ResetPassword=true: способ восстановить доступ там, где команду не запустить
        // (например, на бесплатном Render без shell). Пароль меняется, только если он отличается от текущего,
        // поэтому забытый включённым флаг не сбрасывает пароль и сессии на каждом старте.
        if (await accounts.FindByEmailAsync(email) is { } existing)
        {
            if (configuration.GetValue<bool>("Seed:Admin:ResetPassword") && !await accounts.CheckPasswordAsync(existing, password))
            {
                var reset = await accounts.PromoteAsync(existing, password, ct);
                if (!reset.Succeeded)
                {
                    throw new InvalidOperationException(
                        "Не удалось сменить пароль администратора: " + string.Join("; ", reset.Result.Errors.Select(e => e.Description)));
                }
            }

            return;
        }

        var created = await accounts.CreateAsync(email, password, ct);
        if (!created.Succeeded)
        {
            throw new InvalidOperationException(
                "Не удалось создать администратора: " + string.Join("; ", created.Errors.Select(e => e.Description)));
        }
    }
}
