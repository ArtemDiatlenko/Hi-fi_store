namespace HiFiStore.Api.Cli;

/// <summary>Что делать процессу API: запустить веб-приложение, выполнить команду или показать справку.</summary>
public abstract record CliCommand
{
    private CliCommand()
    {
    }

    /// <summary>Обычный запуск веб-приложения; аргументы передаются хосту (например, <c>--urls</c>).</summary>
    public sealed record RunWebApp : CliCommand;

    /// <summary><c>migrate</c> — применить миграции EF Core и выйти.</summary>
    public sealed record Migrate : CliCommand;

    /// <summary><c>create-admin --email … [--reset-password]</c>.</summary>
    public sealed record CreateAdmin(string Email, bool ResetPassword) : CliCommand;

    /// <summary>Справка: <see cref="Error"/> — что не так с аргументами (тогда код выхода 2).</summary>
    public sealed record Usage(int ExitCode, string? Error = null) : CliCommand;
}

/// <summary>Разбор аргументов командной строки API.</summary>
public static class CommandLine
{
    public const string MigrateName = "migrate";
    public const string CreateAdminName = "create-admin";

    private static readonly string[] HelpNames = ["help", "--help", "-h", "-?", "/?"];

    /// <summary>
    /// Без аргументов — веб-приложение, как раньше. Аргументы, начинающиеся с «-», тоже относятся к веб-приложению:
    /// это настройки хоста вроде <c>--urls</c> или <c>--environment</c>. Первое слово без «-» — имя команды.
    /// </summary>
    public static CliCommand Parse(IReadOnlyList<string> args)
    {
        if (args.Count == 0)
        {
            return new CliCommand.RunWebApp();
        }

        var name = args[0];
        if (HelpNames.Contains(name, StringComparer.OrdinalIgnoreCase))
        {
            return new CliCommand.Usage(ExitCodes.Success);
        }

        if (name.StartsWith('-'))
        {
            return new CliCommand.RunWebApp();
        }

        return name switch
        {
            MigrateName => args.Count == 1
                ? new CliCommand.Migrate()
                : UsageError($"Команда {MigrateName} не принимает аргументов, а передано: {string.Join(' ', args.Skip(1))}."),
            CreateAdminName => ParseCreateAdmin(args.Skip(1).ToList()),
            _ => UsageError($"Неизвестная команда «{name}»."),
        };
    }

    private static CliCommand ParseCreateAdmin(List<string> options)
    {
        string? email = null;
        var resetPassword = false;

        for (var i = 0; i < options.Count; i++)
        {
            var (option, inlineValue) = SplitOption(options[i]);
            switch (option)
            {
                case "--email":
                    if (email is not null)
                    {
                        return UsageError("--email указан несколько раз.");
                    }

                    email = inlineValue ?? (i + 1 < options.Count && !options[i + 1].StartsWith("--", StringComparison.Ordinal)
                        ? options[++i]
                        : null);
                    if (string.IsNullOrWhiteSpace(email))
                    {
                        return UsageError("После --email укажите адрес, например: --email admin@example.com.");
                    }

                    break;

                case "--reset-password" when inlineValue is null:
                    resetPassword = true;
                    break;

                case "--password":
                    return UsageError(
                        "Пароль не передаётся аргументом: он остался бы в истории команд и в списке процессов. " +
                        $"Задайте переменную окружения {AdminPasswordSource.VariableName} " +
                        "или запустите команду в терминале — пароль будет запрошен.");

                default:
                    return UsageError($"Неизвестный параметр команды {CreateAdminName}: «{options[i]}».");
            }
        }

        return email is null
            ? UsageError($"Для команды {CreateAdminName} укажите --email.")
            : new CliCommand.CreateAdmin(email.Trim(), resetPassword);
    }

    // «--email=a@b.c» → («--email», «a@b.c»); «--email» → («--email», null).
    private static (string Option, string? Value) SplitOption(string arg)
    {
        var separator = arg.IndexOf('=');
        return arg.StartsWith("--", StringComparison.Ordinal) && separator > 0
            ? (arg[..separator], arg[(separator + 1)..])
            : (arg, null);
    }

    private static CliCommand.Usage UsageError(string message) => new(ExitCodes.Usage, message);
}

public static class ExitCodes
{
    public const int Success = 0;

    /// <summary>Команда запущена, но не выполнена: база не готова, неверные данные, ошибка Identity или БД.</summary>
    public const int Failure = 1;

    /// <summary>Неизвестная команда или неверные аргументы.</summary>
    public const int Usage = 2;
}
