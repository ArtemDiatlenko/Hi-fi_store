using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Api.Cli;

/// <summary>
/// <c>migrate</c>: применяет миграции EF Core (схема, последовательности, роли) и завершается.
/// Нужен только runtime: миграции скомпилированы в сборку инфраструктуры, SDK и <c>dotnet ef</c> не требуются.
/// Если базы ещё нет, EF Core создаёт её.
/// </summary>
public sealed class MigrateCommand(StoreDbContext db, TextWriter output)
{
    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        output.WriteLine($"База данных: {StoreCli.Describe(db)}.");

        var pending = (await db.Database.GetPendingMigrationsAsync(ct)).ToList();
        if (pending.Count == 0)
        {
            output.WriteLine("Все миграции уже применены.");
            return ExitCodes.Success;
        }

        output.WriteLine($"Применяются миграции ({pending.Count}):");
        foreach (var migration in pending)
        {
            output.WriteLine($"  {migration}");
        }

        await db.Database.MigrateAsync(ct);
        output.WriteLine("Миграции применены.");
        return ExitCodes.Success;
    }
}
