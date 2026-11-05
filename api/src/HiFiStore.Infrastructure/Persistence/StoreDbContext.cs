using HiFiStore.Domain.Catalog;
using HiFiStore.Domain.Inquiries;
using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence.Configurations;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Persistence;

public class StoreDbContext(DbContextOptions options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options), IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys { get; set; } = null!;

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Brand> Brands => Set<Brand>();

    public DbSet<Product> Products => Set<Product>();

    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    public DbSet<SpecDefinition> SpecDefinitions => Set<SpecDefinition>();

    public DbSet<ProductSpec> ProductSpecs => Set<ProductSpec>();

    public DbSet<ProductTranslation> ProductTranslations => Set<ProductTranslation>();

    public DbSet<CategoryTranslation> CategoryTranslations => Set<CategoryTranslation>();

    public DbSet<SpecDefinitionTranslation> SpecDefinitionTranslations => Set<SpecDefinitionTranslation>();

    public DbSet<ProductSpecTranslation> ProductSpecTranslations => Set<ProductSpecTranslation>();

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    public DbSet<Inquiry> Inquiries => Set<Inquiry>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.HasSequence<long>(OrderConfiguration.NumberSequence).StartsAt(100001);
        builder.HasSequence<long>(InquiryConfiguration.NumberSequence).StartsAt(1001);
        builder.ApplyConfigurationsFromAssembly(typeof(StoreDbContext).Assembly);
    }
}
