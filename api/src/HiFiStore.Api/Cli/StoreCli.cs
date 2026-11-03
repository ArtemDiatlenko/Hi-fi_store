using HiFiStore.Infrastructure;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Api.Cli;

/// <summary>
/// Команды обслуживания, которые запускаются тем же исполняемым файлом, что и API:
/// <c>dotnet HiFiStore.Api.dll migrate</c>, <c>dotnet HiFiStore.Api.dll create-admin --email …</c>.
/// Хост собирается с той же конфигурацией (appsettings, переменные окружения), но без HTTP:
/// Kestrel не запускается, регистрируются только EF Core, сервисы магазина и Identity.
/// </summary>
public static class StoreCli
{
    public const string UsageText =
        """
        Использование:
          dotnet HiFiStore.Api.dll
              Запустить API (веб-приложение). Аргументы, начинающиеся с «-», передаются хосту, например --urls.
          dotnet HiFiStore.Api.dll migrate
              Применить миграции базы данных и выйти.
          dotnet HiFiStore.Api.dll create-admin --email <email> [--reset-password]
              Создать администратора (email подтверждён, роль Admin) или выдать роль Admin существующему
              пользователю. С --reset-password существующему пользователю задаётся новый пароль.

        Пароль для create-admin берётся из переменной окружения HIFISTORE_ADMIN_PASSWORD, а если её нет
        и команда запущена в терминале — запрашивается дважды со скрытым вводом. В аргументах пароль не передаётся.
        База данных — из ConnectionStrings__Store, как у веб-приложения.

        Коды выхода: 0 — успех, 1 — ошибка выполнения, 2 — неверная команда или аргументы.

        """;

    /// <summary>Выполняет команду (не <see cref="CliCommand.RunWebApp"/>) и возвращает код выхода.</summary>
    public static async Task<int> RunAsync(
        CliCommand command, TextWriter output, TextWriter error, CancellationToken ct = default)
    {
        if (command is CliCommand.Usage usage)
        {
            if (usage.Error is not null)
            {
                error.WriteLine(usage.Error);
                error.WriteLine();
            }

            (usage.ExitCode == ExitCodes.Success ? output : error).Write(UsageText);
            return usage.ExitCode;
        }

        if (command is not (CliCommand.Migrate or CliCommand.CreateAdmin))
        {
            throw new ArgumentException($"Это не команда обслуживания: {command}.", nameof(command));
        }

        try
        {
            await using var host = BuildHost();
            await using var scope = host.Services.CreateAsyncScope();
            var services = scope.ServiceProvider;

            if (command is CliCommand.CreateAdmin createAdmin)
            {
                return await new CreateAdminCommand(
                        services.GetRequiredService<StoreDbContext>(),
                        services.GetRequiredService<AdminAccountService>(),
                        new AdminPasswordSource(),
                        output,
                        error)
                    .RunAsync(createAdmin.Email, createAdmin.ResetPassword, ct);
            }

            return await new MigrateCommand(services.GetRequiredService<StoreDbContext>(), output).RunAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Нет строки подключения, база недоступна и т. п. — понятное сообщение вместо трассировки стека.
            error.WriteLine($"Ошибка: {ex.Message}");
            for (var inner = ex.InnerException; inner is not null; inner = inner.InnerException)
            {
                error.WriteLine($"  {inner.Message}");
            }

            return ExitCodes.Failure;
        }
    }

    /// <summary>
    /// Хост для команд: конфигурация как у веб-приложения, но сервер не запускается.
    /// <paramref name="settings"/> дополняют конфигурацию (используется в тестах).
    /// </summary>
    public static WebApplication BuildHost(IEnumerable<KeyValuePair<string, string?>>? settings = null)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ApplicationName = typeof(StoreCli).Assembly.GetName().Name,
        });

        if (settings is not null)
        {
            builder.Configuration.AddInMemoryCollection(settings);
        }

        // Команде достаточно своих сообщений: SQL-команды EF Core и прочие Information-логи не выводятся.
        // Ошибки подключения команда сообщает сама, а EF Core пишет их и при обычной проверке, что базы ещё нет.
        builder.Logging.AddFilter(level => level >= LogLevel.Warning);
        builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Connection", LogLevel.None);

        builder.Services.AddStoreInfrastructure(builder.Configuration);
        builder.Services
            .AddIdentityCore<ApplicationUser>(StoreIdentity.ConfigureOptions)
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<StoreDbContext>();

        return builder.Build();
    }

    /// <summary>Имя базы и сервер — чтобы было видно, с какой базой работает команда. Пароль не выводится.</summary>
    public static string Describe(StoreDbContext db)
    {
        var connection = db.Database.GetDbConnection();
        return $"«{connection.Database}» ({connection.DataSource})";
    }
}
