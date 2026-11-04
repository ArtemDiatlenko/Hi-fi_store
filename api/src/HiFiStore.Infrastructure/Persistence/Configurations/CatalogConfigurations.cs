using HiFiStore.Domain.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HiFiStore.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.Property(c => c.Name).HasMaxLength(200);
        builder.Property(c => c.Slug).HasMaxLength(200);
        builder.HasIndex(c => c.Slug).IsUnique();

        builder.HasOne(c => c.Parent)
            .WithMany(c => c.Children)
            .HasForeignKey(c => c.ParentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class BrandConfiguration : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> builder)
    {
        builder.Property(b => b.Name).HasMaxLength(200);
        builder.Property(b => b.Slug).HasMaxLength(200);
        builder.Property(b => b.Country).HasMaxLength(100);
        builder.HasIndex(b => b.Slug).IsUnique();
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.Property(p => p.Sku).HasMaxLength(64);
        builder.Property(p => p.Name).HasMaxLength(300);
        builder.Property(p => p.Slug).HasMaxLength(300);
        builder.Property(p => p.ShortDescription).HasMaxLength(500);
        builder.Property(p => p.Price).HasPrecision(12, 2);
        builder.Property(p => p.OldPrice).HasPrecision(12, 2);

        builder.HasIndex(p => p.Slug).IsUnique();
        builder.HasIndex(p => p.Sku).IsUnique();
        builder.HasIndex(p => new { p.CategoryId, p.IsPublished });

        builder.HasOne(p => p.Category)
            .WithMany()
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.Brand)
            .WithMany(b => b.Products)
            .HasForeignKey(p => p.BrandId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(p => p.Images)
            .WithOne()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.Property(i => i.Url).HasMaxLength(1000);
        builder.Property(i => i.Alt).HasMaxLength(300);
    }
}

internal sealed class SpecDefinitionConfiguration : IEntityTypeConfiguration<SpecDefinition>
{
    public void Configure(EntityTypeBuilder<SpecDefinition> builder)
    {
        builder.Property(s => s.Key).HasMaxLength(64);
        builder.Property(s => s.Name).HasMaxLength(200);
        builder.Property(s => s.Unit).HasMaxLength(32);
        builder.HasIndex(s => new { s.CategoryId, s.Key }).IsUnique();

        builder.HasOne(s => s.Category)
            .WithMany(c => c.Specs)
            .HasForeignKey(s => s.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProductSpecConfiguration : IEntityTypeConfiguration<ProductSpec>
{
    public void Configure(EntityTypeBuilder<ProductSpec> builder)
    {
        builder.HasKey(s => new { s.ProductId, s.SpecDefinitionId });
        builder.Property(s => s.TextValue).HasMaxLength(500);
        builder.Property(s => s.NumberValue).HasPrecision(14, 4);

        builder.HasOne(s => s.Product)
            .WithMany(p => p.Specs)
            .HasForeignKey(s => s.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.SpecDefinition)
            .WithMany()
            .HasForeignKey(s => s.SpecDefinitionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.SpecDefinitionId, s.NumberValue });
        builder.HasIndex(s => new { s.SpecDefinitionId, s.TextValue });
    }
}

internal sealed class ProductTranslationConfiguration : IEntityTypeConfiguration<ProductTranslation>
{
    public void Configure(EntityTypeBuilder<ProductTranslation> builder)
    {
        builder.HasKey(t => new { t.ProductId, t.Locale });
        builder.Property(t => t.Locale).HasMaxLength(8);
        builder.Property(t => t.Name).HasMaxLength(300);
        builder.Property(t => t.ShortDescription).HasMaxLength(500);
        builder.HasOne<Product>().WithMany(p => p.Translations).HasForeignKey(t => t.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class CategoryTranslationConfiguration : IEntityTypeConfiguration<CategoryTranslation>
{
    public void Configure(EntityTypeBuilder<CategoryTranslation> builder)
    {
        builder.HasKey(t => new { t.CategoryId, t.Locale });
        builder.Property(t => t.Locale).HasMaxLength(8);
        builder.Property(t => t.Name).HasMaxLength(200);
        builder.HasOne<Category>().WithMany(c => c.Translations).HasForeignKey(t => t.CategoryId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SpecDefinitionTranslationConfiguration : IEntityTypeConfiguration<SpecDefinitionTranslation>
{
    public void Configure(EntityTypeBuilder<SpecDefinitionTranslation> builder)
    {
        builder.HasKey(t => new { t.SpecDefinitionId, t.Locale });
        builder.Property(t => t.Locale).HasMaxLength(8);
        builder.Property(t => t.Name).HasMaxLength(200);
        builder.Property(t => t.Unit).HasMaxLength(32);
        builder.HasOne<SpecDefinition>().WithMany(d => d.Translations).HasForeignKey(t => t.SpecDefinitionId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProductSpecTranslationConfiguration : IEntityTypeConfiguration<ProductSpecTranslation>
{
    public void Configure(EntityTypeBuilder<ProductSpecTranslation> builder)
    {
        builder.HasKey(t => new { t.ProductId, t.SpecDefinitionId, t.Locale });
        builder.Property(t => t.Locale).HasMaxLength(8);
        builder.Property(t => t.TextValue).HasMaxLength(500);
        builder.HasOne<ProductSpec>()
            .WithMany(s => s.Translations)
            .HasForeignKey(t => new { t.ProductId, t.SpecDefinitionId })
            .OnDelete(DeleteBehavior.Cascade);
    }
}
