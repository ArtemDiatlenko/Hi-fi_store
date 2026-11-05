using HiFiStore.Infrastructure.Email;
using HiFiStore.Infrastructure.Translation;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.TestHost;
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
/// <para>
/// Каждый класс тестов получает свой экземпляр фабрики (<c>IClassFixture</c>), и классы идут параллельно,
/// а база у всех общая. Поэтому подготовка базы — общая на процесс (статические флаг и блокировка), и
/// xUnit выполняет её при создании фикстуры (<see cref="IAsyncLifetime.InitializeAsync"/>), то есть до первого
/// теста любого класса: ни один тест не обратится к базе, пока другой класс её пересоздаёт.
/// Тесты вызывают <see cref="PrepareAsync"/> — он пропускает тест без настроенной базы.
/// </para>
/// </summary>
public sealed class StoreWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminEmail = "admin@test.local";
    public const string AdminPassword = "Admin-test-2026";

    private const string SkipReason = "Задайте HIFISTORE_TEST_CONNECTION, чтобы запускать интеграционные тесты.";

    private static readonly SemaphoreSlim InitLock = new(1, 1);
    private static bool _initialized;

    public static string? ConnectionString => Environment.GetEnvironmentVariable("HIFISTORE_TEST_CONNECTION");

    public static bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);

    /// <summary>
    /// Пропускает тест, если база для интеграционных тестов не настроена, и дожидается её подготовки.
    /// Вызывайте в начале каждого интеграционного теста.
    /// </summary>
    public async Task PrepareAsync()
    {
        Skip.IfNot(IsConfigured, SkipReason);
        await EnsureDatabaseAsync();
    }

    /// <summary>Пересоздаёт базу и заполняет её — один раз на процесс; остальные вызовы ждут и выходят.</summary>
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

    async Task IAsyncLifetime.InitializeAsync()
    {
        if (IsConfigured)
        {
            await EnsureDatabaseAsync();
        }
    }

    // Сам хост освобождает xUnit через IDisposable фабрики.
    Task IAsyncLifetime.DisposeAsync() => Task.CompletedTask;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Store", ConnectionString);
        builder.UseSetting("Store:DemoCatalog", "true");
        builder.UseSetting("Seed:Admin:Email", AdminEmail);
        builder.UseSetting("Seed:Admin:Password", AdminPassword);
        builder.UseSetting("Store:PublicUrl", PublicUrl);
        builder.UseSetting("Store:OwnerEmail", OwnerEmail);
        builder.UseSetting("Media:Disk:Path", MediaRoot);
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IEmailTransport>(Emails);
            services.AddSingleton<IMachineTranslator>(Translator);
        });
    }

    public const string PublicUrl = "https://shop.test";
    public const string OwnerEmail = "owner@test.local";

    /// <summary>Загруженные в тестах файлы — во временной папке, а не в каталоге API.</summary>
    public static string MediaRoot { get; } = Path.Combine(Path.GetTempPath(), "hifistore-test-media");

    /// <summary>Письма, «отправленные» этим экземпляром API.</summary>
    public CapturedEmails Emails { get; } = new();

    /// <summary>Подменный машинный переводчик: по умолчанию выключен, тесты включают его сами.</summary>
    public FakeMachineTranslator Translator { get; } = new();
}
