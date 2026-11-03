using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using HiFiStore.Api.Cli;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace HiFiStore.Tests.Integration;

/// <summary>
/// Команды <c>create-admin</c> и <c>migrate</c> на общей тестовой базе. Команды выполняются через хост команд
/// (<see cref="StoreCli.BuildHost"/>, без HTTP) — как в продакшене, а результат проверяется через веб-API.
/// </summary>
public sealed class CliCommandsTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private const string AdminPassword = "Cli-admin-2026";

    private readonly HttpClient _client = factory.CreateClient();

    [SkippableFact]
    public async Task CreateAdmin_NewUser_IsConfirmedAdmin_AndCanUseAdminApi()
    {
        await factory.PrepareAsync();
        var email = NewEmail();

        var run = await CreateAdminAsync(email, new FakePasswordSource(AdminPassword));

        Assert.Equal(ExitCodes.Success, run.ExitCode);
        Assert.Contains($"Создан администратор {email}", run.Output);
        Assert.Empty(run.Error);

        var user = await FindUserAsync(email);
        Assert.True(user.EmailConfirmed);
        Assert.Equal([Roles.Admin], await GetRolesAsync(email));
        await AssertAdminApiAccessAsync(email, AdminPassword);
    }

    [SkippableFact]
    public async Task CreateAdmin_ExistingUser_GetsAdminRole_WithoutTouchingPassword()
    {
        await factory.PrepareAsync();
        var email = await _client.RegisterNewUserAsync("cli-customer");
        var passwords = new FakePasswordSource("Not-used-2026");

        var run = await CreateAdminAsync(email, passwords);

        Assert.Equal(ExitCodes.Success, run.ExitCode);
        Assert.Contains($"Пользователю {email} выдана роль Admin", run.Output);
        Assert.Contains("Пароль не изменён", run.Output);
        Assert.Equal(0, passwords.Calls);
        Assert.Equal([Roles.Admin, Roles.Customer], (await GetRolesAsync(email)).Order());
        await AssertAdminApiAccessAsync(email, HttpClientAuthExtensions.CustomerPassword);

        var again = await CreateAdminAsync(email, passwords);
        Assert.Equal(ExitCodes.Success, again.ExitCode);
        Assert.Contains($"У пользователя {email} уже есть роль Admin", again.Output);
    }

    [SkippableFact]
    public async Task CreateAdmin_ResetPassword_SetsNewPassword_AndLiftsLockout()
    {
        await factory.PrepareAsync();
        var email = await _client.RegisterNewUserAsync("cli-reset");
        using (var scope = factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await users.FindByEmailAsync(email);
            await users.SetLockoutEndDateAsync(user!, DateTimeOffset.UtcNow.AddHours(1));
        }

        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatusAsync(email, HttpClientAuthExtensions.CustomerPassword));

        var run = await CreateAdminAsync(email, new FakePasswordSource(AdminPassword), resetPassword: true);

        Assert.Equal(ExitCodes.Success, run.ExitCode);
        Assert.Contains("Пароль изменён", run.Output);
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatusAsync(email, HttpClientAuthExtensions.CustomerPassword));
        await AssertAdminApiAccessAsync(email, AdminPassword);
    }

    [SkippableFact]
    public async Task CreateAdmin_WeakPassword_PrintsIdentityErrors_AndCreatesNothing()
    {
        await factory.PrepareAsync();
        var email = NewEmail();

        var run = await CreateAdminAsync(email, new FakePasswordSource("weak"));

        Assert.Equal(ExitCodes.Failure, run.ExitCode);
        Assert.Contains(new IdentityErrorDescriber().PasswordTooShort(8).Description, run.Error);
        Assert.Contains(new IdentityErrorDescriber().PasswordRequiresDigit().Description, run.Error);
        Assert.Null(await FindUserOrNullAsync(email));
    }

    [SkippableFact]
    public async Task CreateAdmin_WeakPasswordOnReset_KeepsOldPasswordAndRoles()
    {
        await factory.PrepareAsync();
        var email = await _client.RegisterNewUserAsync("cli-weak-reset");

        var run = await CreateAdminAsync(email, new FakePasswordSource("weak"), resetPassword: true);

        Assert.Equal(ExitCodes.Failure, run.ExitCode);
        Assert.Contains(new IdentityErrorDescriber().PasswordTooShort(8).Description, run.Error);
        Assert.Equal([Roles.Customer], await GetRolesAsync(email));
        Assert.Equal(HttpStatusCode.OK, await LoginStatusAsync(email, HttpClientAuthExtensions.CustomerPassword));
    }

    [SkippableFact]
    public async Task CreateAdmin_WithoutPassword_FailsForNewUser()
    {
        await factory.PrepareAsync();
        var email = NewEmail();

        var run = await CreateAdminAsync(email, new FakePasswordSource(null));

        Assert.Equal(ExitCodes.Failure, run.ExitCode);
        Assert.Contains(FakePasswordSource.NoPasswordMessage, run.Error);
        Assert.Null(await FindUserOrNullAsync(email));
    }

    [SkippableTheory]
    [InlineData("not-an-email")]
    [InlineData("Admin <admin@example.com>")]
    [InlineData("admin@")]
    public async Task CreateAdmin_InvalidEmail_Fails(string email)
    {
        await factory.PrepareAsync();
        var passwords = new FakePasswordSource(AdminPassword);

        var run = await CreateAdminAsync(email, passwords);

        Assert.Equal(ExitCodes.Failure, run.ExitCode);
        Assert.Contains("Некорректный email", run.Error);
        Assert.Equal(0, passwords.Calls);
    }

    /// <summary>
    /// База без миграций: команда отказывается работать и советует migrate. Используется несуществующая база —
    /// проверка миграций её не создаёт, так что после теста ничего не остаётся.
    /// </summary>
    [SkippableFact]
    public async Task CreateAdmin_PendingMigrations_TellsToRunMigrate()
    {
        await factory.PrepareAsync();
        var missing = new NpgsqlConnectionStringBuilder(StoreWebApplicationFactory.ConnectionString)
        {
            Database = $"hifistore_cli_missing_{Guid.NewGuid():N}",
        };
        var passwords = new FakePasswordSource(AdminPassword);

        var run = await CreateAdminAsync(NewEmail(), passwords, connectionString: missing.ConnectionString);

        Assert.Equal(ExitCodes.Failure, run.ExitCode);
        Assert.Contains("не применены миграции", run.Error);
        Assert.Contains("dotnet HiFiStore.Api.dll migrate", run.Error);
        Assert.Equal(0, passwords.Calls);
        Assert.False(await DatabaseExistsAsync(missing.Database!));
    }

    [SkippableFact]
    public async Task Migrate_UpToDateDatabase_ReportsNothingToApply()
    {
        await factory.PrepareAsync();
        await using var host = BuildCommandHost();
        await using var scope = host.Services.CreateAsyncScope();
        var output = new StringWriter();

        var code = await new MigrateCommand(scope.ServiceProvider.GetRequiredService<StoreDbContext>(), output).RunAsync();

        Assert.Equal(ExitCodes.Success, code);
        Assert.Contains("Все миграции уже применены", output.ToString());
    }

    private static string NewEmail() => $"cli-admin-{Guid.NewGuid():N}@test.local";

    private static WebApplication BuildCommandHost(string? connectionString = null) =>
        StoreCli.BuildHost([new("ConnectionStrings:Store", connectionString ?? StoreWebApplicationFactory.ConnectionString)]);

    private static async Task<CommandRun> CreateAdminAsync(
        string email, FakePasswordSource passwords, bool resetPassword = false, string? connectionString = null)
    {
        await using var host = BuildCommandHost(connectionString);
        await using var scope = host.Services.CreateAsyncScope();
        var output = new StringWriter();
        var error = new StringWriter();
        var command = new CreateAdminCommand(
            scope.ServiceProvider.GetRequiredService<StoreDbContext>(),
            scope.ServiceProvider.GetRequiredService<AdminAccountService>(),
            passwords,
            output,
            error);

        var code = await command.RunAsync(email, resetPassword);
        return new CommandRun(code, output.ToString(), error.ToString());
    }

    private async Task<ApplicationUser?> FindUserOrNullAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByEmailAsync(email);
    }

    private async Task<ApplicationUser> FindUserAsync(string email) =>
        await FindUserOrNullAsync(email) ?? throw new InvalidOperationException($"Пользователь {email} не найден.");

    private async Task<IList<string>> GetRolesAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return await users.GetRolesAsync((await users.FindByEmailAsync(email))!);
    }

    private async Task<HttpStatusCode> LoginStatusAsync(string email, string password) =>
        (await _client.PostAsJsonAsync("/api/auth/login", new { email, password })).StatusCode;

    private async Task AssertAdminApiAccessAsync(string email, string password)
    {
        var token = await _client.LoginAsync(email, password);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/brands");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(request)).StatusCode);
    }

    private async Task<bool> DatabaseExistsAsync(string name)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        return await db.Database
            .SqlQuery<int>($"SELECT 1 AS \"Value\" FROM pg_database WHERE datname = {name}")
            .AnyAsync();
    }

    private sealed record CommandRun(int ExitCode, string Output, string Error);

    private sealed class FakePasswordSource(string? password) : IAdminPasswordSource
    {
        public const string NoPasswordMessage = "Пароль не задан (тест).";

        public int Calls { get; private set; }

        public string? GetPassword(TextWriter error)
        {
            Calls++;
            if (password is null)
            {
                error.WriteLine(NoPasswordMessage);
            }

            return password;
        }
    }
}
