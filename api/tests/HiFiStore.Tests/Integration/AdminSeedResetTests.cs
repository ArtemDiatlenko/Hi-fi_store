using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence.Seeding;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Integration;

/// <summary>Seed:Admin:ResetPassword — восстановление пароля администратора при старте. Свой пользователь на тест.</summary>
public sealed class AdminSeedResetTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private const string OldPassword = "Old-admin-2026!";
    private const string NewPassword = "New-admin-2026!";

    [SkippableFact]
    public async Task ResetPassword_ChangesPasswordOnlyWhenEnabled_AndClearsLockout()
    {
        await factory.PrepareAsync();
        var email = $"seed-admin-{Guid.NewGuid():N}@test.local";
        using (var scope = factory.Services.CreateScope())
        {
            var accounts = scope.ServiceProvider.GetRequiredService<AdminAccountService>();
            Assert.True((await accounts.CreateAsync(email, OldPassword)).Succeeded);
            var users = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ApplicationUser>>();
            var user = (await users.FindByEmailAsync(email))!;
            await users.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddHours(1));
        }

        // Без флага существующему администратору пароль не меняется.
        await InitializeAsync(email, NewPassword, reset: false);
        Assert.True(await CheckAsync(email, OldPassword));

        // С флагом — меняется, и блокировка входа снимается.
        await InitializeAsync(email, NewPassword, reset: true);
        Assert.True(await CheckAsync(email, NewPassword));
        Assert.False(await CheckAsync(email, OldPassword));
        using (var scope = factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ApplicationUser>>();
            Assert.False(await users.IsLockedOutAsync((await users.FindByEmailAsync(email))!));
        }

        // Повторный старт с тем же паролем ничего не меняет (штамп безопасности тот же — сессии не сбрасываются).
        var stamp = await SecurityStampAsync(email);
        await InitializeAsync(email, NewPassword, reset: true);
        Assert.Equal(stamp, await SecurityStampAsync(email));
    }

    private Task InitializeAsync(string email, string password, bool reset)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Seed:Admin:Email"] = email,
                ["Seed:Admin:Password"] = password,
                ["Seed:Admin:ResetPassword"] = reset ? "true" : "false",
            })
            .Build();
        return StoreDbInitializer.InitializeAsync(factory.Services, configuration);
    }

    private async Task<bool> CheckAsync(string email, string password)
    {
        using var scope = factory.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<AdminAccountService>();
        return await accounts.CheckPasswordAsync((await accounts.FindByEmailAsync(email))!, password);
    }

    private async Task<string?> SecurityStampAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<AdminAccountService>();
        return (await accounts.FindByEmailAsync(email))!.SecurityStamp;
    }
}
