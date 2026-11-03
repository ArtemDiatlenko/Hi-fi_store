using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HiFiStore.Tests.Persistence;

/// <summary>Проверки модели EF без подключения к базе.</summary>
public class StoreModelTests
{
    [Fact]
    public void Migrations_AreInSyncWithModel()
    {
        using var db = CreateContext();

        Assert.False(
            db.Database.HasPendingModelChanges(),
            "Модель изменена без миграции (или снимок модели испорчен при слиянии): добавьте миграцию через dotnet ef migrations add.");
    }

    [Fact]
    public void Roles_AreSeededWithFixedIdsAndIdentityNormalizedNames()
    {
        using var db = CreateContext();
        var normalizer = new UpperInvariantLookupNormalizer();

        var seeded = db.GetService<IDesignTimeModel>().Model
            .FindEntityType(typeof(IdentityRole<Guid>))!
            .GetSeedData()
            .ToList();

        Assert.Equal(Roles.All.Order(), seeded.Select(r => (string)r["Name"]!).Order());
        foreach (var role in seeded)
        {
            var name = (string)role["Name"]!;
            Assert.Equal(Roles.Ids[name], (Guid)role["Id"]!);
            Assert.Equal(normalizer.NormalizeName(name), role["NormalizedName"]);
            Assert.NotNull(role["ConcurrencyStamp"]);
        }
    }

    private static StoreDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<StoreDbContext>().UseNpgsql("Host=localhost;Database=model_only").Options);
}
