using HiFiStore.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HiFiStore.Infrastructure.Persistence.Configurations;

/// <summary>
/// Роли приложения — часть схемы данных: они создаются миграцией, а не при старте, чтобы регистрация
/// работала в любом окружении, в том числе без <c>Store:AutoMigrate</c>. Значения постоянные:
/// иначе EF считал бы модель изменённой при каждой сборке.
/// </summary>
internal sealed class RoleConfiguration : IEntityTypeConfiguration<IdentityRole<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityRole<Guid>> builder) =>
        builder.HasData(
            Role(Roles.Admin, "d8b99957-9655-4730-b553-707100fd977d"),
            Role(Roles.Customer, "8a50ba08-d637-481c-a5d4-485633aeaa95"));

    // NormalizedName — как у RoleManager (UpperInvariantLookupNormalizer), чтобы роли находились по имени.
    private static IdentityRole<Guid> Role(string name, string concurrencyStamp) => new()
    {
        Id = Roles.Ids[name],
        Name = name,
        NormalizedName = name.ToUpperInvariant(),
        ConcurrencyStamp = concurrencyStamp,
    };
}
