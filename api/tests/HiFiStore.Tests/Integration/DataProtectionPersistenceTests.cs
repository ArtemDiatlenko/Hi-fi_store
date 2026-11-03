using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Integration;

public sealed class DataProtectionPersistenceTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    [SkippableFact]
    public async Task ProtectedLinks_AreReadableByFreshProvider_WithKeysStoredInDatabase()
    {
        await factory.PrepareAsync();
        var payload = $"confirmation-{Guid.NewGuid():N}";
        string protectedValue;
        using (var first = Services())
        {
            protectedValue = first.GetRequiredService<IDataProtectionProvider>().CreateProtector("email-link-test").Protect(payload);
            using var scope = first.CreateScope();
            Assert.True(await scope.ServiceProvider.GetRequiredService<StoreDbContext>().DataProtectionKeys.AnyAsync());
        }

        // Другой контейнер DI, новый KeyRingProvider, прежняя БД — как после перезапуска контейнера Render.
        using var restarted = Services();
        var protector = restarted.GetRequiredService<IDataProtectionProvider>().CreateProtector("email-link-test");
        Assert.Equal(payload, protector.Unprotect(protectedValue));
    }

    private static ServiceProvider Services()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<StoreDbContext>(options => options.UseNpgsql(StoreWebApplicationFactory.ConnectionString));
        services.AddDataProtection().SetApplicationName("HiFiStore").PersistKeysToDbContext<StoreDbContext>();
        return services.BuildServiceProvider();
    }

    [SkippableFact]
    public async Task LoginToken_WorksAcrossIndependentApiInstances()
    {
        await factory.PrepareAsync();
        using var first = factory.CreateClient();
        var token = await OrderTestHelpers.LoginAdminAsync(first);
        using var restartedFactory = new StoreWebApplicationFactory();
        using var restarted = restartedFactory.CreateClient();
        var response = await OrderTestHelpers.SendAsync(restarted, HttpMethod.Get, "/api/account/me", token);
        response.EnsureSuccessStatusCode();
    }
}
