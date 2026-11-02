using HiFiStore.Infrastructure.Persistence;
using HiFiStore.Infrastructure.Persistence.Seeding;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Integration;

/// <summary>
/// Поднимает API с реальным PostgreSQL. Строка подключения берётся из переменной
/// <c>HIFISTORE_TEST_CONNECTION</c>; без неё интеграционные тесты пропускаются.
/// База пересоздаётся один раз на запуск тестов и заполняется демо-каталогом.
/// </summary>
public sealed class StoreWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string AdminEmail = "admin@test.local";
    public const string AdminPassword = "Admin-test-2026";

    private static readonly SemaphoreSlim InitLock = new(1, 1);
    private static bool _initialized;

    public static string? ConnectionString => Environment.GetEnvironmentVariable("HIFISTORE_TEST_CONNECTION");

    public static bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Store", ConnectionString);
        builder.UseSetting("Store:DemoCatalog", "true");
        builder.UseSetting("Seed:Admin:Email", AdminEmail);
        builder.UseSetting("Seed:Admin:Password", AdminPassword);
    }

    public async Task EnsureDatabaseAsync()
    {
        await InitLock.WaitAsync();
        try
        {
            if (_initialized)
            {
                return;
            }

            using (var scope = Services.CreateScope())
            {
                await scope.ServiceProvider.GetRequiredService<StoreDbContext>().Database.EnsureDeletedAsync();
            }

            await StoreDbInitializer.InitializeAsync(Services, Services.GetRequiredService<IConfiguration>());
            _initialized = true;
        }
        finally
        {
            InitLock.Release();
        }
    }
}
