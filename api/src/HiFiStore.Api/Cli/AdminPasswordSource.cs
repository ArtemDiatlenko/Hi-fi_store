using System.Text;

namespace HiFiStore.Api.Cli;

/// <summary>Откуда команда <c>create-admin</c> берёт пароль. В тестах подменяется.</summary>
public interface IAdminPasswordSource
{
    /// <summary>Пароль или <c>null</c>, если его взять неоткуда; причину пишет в <paramref name="error"/>.</summary>
    string? GetPassword(TextWriter error);
}

/// <summary>
/// Пароль из переменной окружения <see cref="VariableName"/>, а если её нет и ввод идёт с терминала —
/// запрос со скрытым вводом и подтверждением. Аргументом командной строки пароль не принимается:
/// он остался бы в истории оболочки и был бы виден в списке процессов.
/// </summary>
public sealed class AdminPasswordSource : IAdminPasswordSource
{
    public const string VariableName = "HIFISTORE_ADMIN_PASSWORD";

    public string? GetPassword(TextWriter error)
    {
        var fromEnvironment = Environment.GetEnvironmentVariable(VariableName);
        if (!string.IsNullOrEmpty(fromEnvironment))
        {
            return fromEnvironment;
        }

        if (Console.IsInputRedirected)
        {
            error.WriteLine(
                $"Пароль не задан: установите переменную окружения {VariableName} " +
                "или запустите команду в терминале, чтобы ввести пароль.");
            return null;
        }

        var password = ReadHidden(error, "Пароль администратора: ");
        if (password.Length == 0)
        {
            error.WriteLine("Пароль не введён.");
            return null;
        }

        if (ReadHidden(error, "Повторите пароль: ") != password)
        {
            error.WriteLine("Пароли не совпадают.");
            return null;
        }

        return password;
    }

    // Символы не отображаются; Backspace удаляет последний, Enter завершает ввод.
    private static string ReadHidden(TextWriter prompt, string text)
    {
        prompt.Write(text);
        prompt.Flush();

        var input = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter)
            {
                break;
            }

            if (key.Key == ConsoleKey.Backspace)
            {
                if (input.Length > 0)
                {
                    input.Length--;
                }
            }
            else if (!char.IsControl(key.KeyChar))
            {
                input.Append(key.KeyChar);
            }
        }

        prompt.WriteLine();
        return input.ToString();
    }
}
