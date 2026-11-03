using HiFiStore.Domain.Inquiries;
using HiFiStore.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HiFiStore.Infrastructure.Persistence.Configurations;

internal sealed class InquiryConfiguration : IEntityTypeConfiguration<Inquiry>
{
    /// <summary>Последовательность номеров заявок (объявлена в <see cref="StoreDbContext"/>).</summary>
    public const string NumberSequence = "inquiry_numbers";

    public void Configure(EntityTypeBuilder<Inquiry> builder)
    {
        builder.Property(i => i.Number).HasDefaultValueSql($"nextval('{NumberSequence}')");
        builder.HasIndex(i => i.Number).IsUnique();

        builder.Property(i => i.Name).HasMaxLength(200);
        builder.Property(i => i.Phone).HasMaxLength(32);
        builder.Property(i => i.Email).HasMaxLength(254);
        builder.Property(i => i.Message).HasMaxLength(3000);
        builder.Property(i => i.Budget).HasMaxLength(100);
        builder.Property(i => i.ProductName).HasMaxLength(300);
        builder.Property(i => i.ProductSlug).HasMaxLength(200);
        builder.Property(i => i.AdminNote).HasMaxLength(3000);

        builder.HasIndex(i => new { i.Status, i.CreatedAt });
        builder.HasIndex(i => i.CreatedAt);

        // Удаление пользователя не удаляет его заявки.
        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(i => i.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
