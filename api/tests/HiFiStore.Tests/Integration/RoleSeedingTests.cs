using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using HiFiStore.Infrastructure.Persistence.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Integration;

/// <summary>Роли создаёт миграция SeedIdentityRoles, а не инициализатор при старте.</summary>
public sealed class RoleSeedingTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    [SkippableFact]
    public async Task Roles_ComeFromMigration_AndRegistrationUsesThem()
    {
        await factory.PrepareAsync();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();

        // Инициализатор создал бы роли со случайными Id; постоянные Id означают, что роли уже были после миграций,
        // то есть регистрация не зависит от того, запускался ли инициализатор (Store:AutoMigrate).
        var roles = await db.Roles.AsNoTracking().OrderBy(r => r.Name).Select(r => new { r.Name, r.Id }).ToListAsync();
        Assert.Equal(
            Roles.Ids.OrderBy(r => r.Key).Select(r => (r.Key, r.Value)),
            roles.Select(r => (r.Name!, r.Id)));

        var email = await factory.CreateClient().RegisterNewUserAsync();
        var userId = await db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync();
        var roleIds = await db.UserRoles.Where(ur => ur.UserId == userId).Select(ur => ur.RoleId).ToListAsync();
        Assert.Equal([Roles.Ids[Roles.Customer]], roleIds);
    }

    [SkippableFact]
    public async Task SeedIdentityRolesMigration_AdoptsRoleCreatedBeforeIt()
    {
        await factory.PrepareAsync();
        var email = await factory.CreateClient().RegisterNewUserAsync();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        var userId = await db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync();
        var customerId = Roles.Ids[Roles.Customer];
        var legacyId = Guid.NewGuid();

        // Всё в транзакции, которая откатывается: общая тестовая база не меняется.
        await using var transaction = await db.Database.BeginTransactionAsync();

        // Состояние базы до миграции: роль Customer создана инициализатором со случайным Id.
        await db.Database.ExecuteSqlAsync($"""DELETE FROM "AspNetRoles" WHERE "Id" = {customerId}""");
        await db.Database.ExecuteSqlAsync(
            $"""INSERT INTO "AspNetRoles" ("Id", "Name", "NormalizedName", "ConcurrencyStamp") VALUES ({legacyId}, 'Customer', 'CUSTOMER', 'legacy')""");
        await db.Database.ExecuteSqlAsync($"""INSERT INTO "AspNetUserRoles" ("UserId", "RoleId") VALUES ({userId}, {legacyId})""");

        foreach (var operation in new SeedIdentityRoles().UpOperations.Cast<SqlOperation>())
        {
            await db.Database.ExecuteSqlRawAsync(operation.Sql);
        }

        var customerRoles = await db.Roles.AsNoTracking()
            .Where(r => r.NormalizedName!.StartsWith("CUSTOMER"))
            .Select(r => r.Id)
            .ToListAsync();
        Assert.Equal([customerId], customerRoles);
        Assert.Equal([customerId], await db.UserRoles.Where(ur => ur.UserId == userId).Select(ur => ur.RoleId).ToListAsync());
        var adminId = Roles.Ids[Roles.Admin];
        Assert.True(await db.Roles.AnyAsync(r => r.Id == adminId && r.NormalizedName == "ADMIN"));

        await transaction.RollbackAsync();
    }
}
