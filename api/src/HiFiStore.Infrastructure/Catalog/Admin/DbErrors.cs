using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HiFiStore.Infrastructure.Catalog.Admin;

/// <summary>
/// Распознаёт нарушения ограничений PostgreSQL. Сервисы проверяют уникальность и связи заранее,
/// а эти проверки ловят гонку между проверкой и сохранением.
/// </summary>
internal static class DbErrors
{
    public static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    public static bool IsForeignKeyViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation };
}
