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
    /// <item><c>Store:DemoCatalog</c> — заполнить каталог тестовыми данными, если товаров ещё нет.</item>
    /// </list>
    /// </summary>
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration configuration, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;

        var db = provider.GetRequiredService<StoreDbContext>();
        await db.Database.MigrateAsync(ct);

        await EnsureRolesAsync(provider.GetRequiredService<RoleManager<IdentityRole<Guid>>>());
        await EnsureAdminAsync(provider.GetRequiredService<UserManager<ApplicationUser>>(), configuration);

        if (configuration.GetValue<bool>("Store:DemoCatalog") && !await db.Products.AnyAsync(ct))
        {
            await DemoCatalog.SeedAsync(db, ct);
        }
    }

    private static async Task EnsureRolesAsync(RoleManager<IdentityRole<Guid>> roles)
    {
        foreach (var role in Roles.All)
        {
            if (!await roles.RoleExistsAsync(role))
            {
                await roles.CreateAsync(new IdentityRole<Guid>(role) { Id = Guid.NewGuid() });
            }
        }
    }

    private static async Task EnsureAdminAsync(UserManager<ApplicationUser> users, IConfiguration configuration)
    {
        var email = configuration["Seed:Admin:Email"];
        var password = configuration["Seed:Admin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        if (await users.FindByEmailAsync(email) is not null)
        {
            return;
        }

        var admin = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FullName = "Администратор",
        };

        var created = await users.CreateAsync(admin, password);
        if (!created.Succeeded)
        {
            throw new InvalidOperationException(
                "Не удалось создать администратора: " + string.Join("; ", created.Errors.Select(e => e.Description)));
        }

        await users.AddToRoleAsync(admin, Roles.Admin);
    }
}
