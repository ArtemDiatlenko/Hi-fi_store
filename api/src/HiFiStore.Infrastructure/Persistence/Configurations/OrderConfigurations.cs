using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HiFiStore.Infrastructure.Persistence.Configurations;

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    /// <summary>Последовательность номеров заказов (объявлена в <see cref="StoreDbContext"/>).</summary>
    public const string NumberSequence = "order_numbers";

    public void Configure(EntityTypeBuilder<Order> builder)
    {
        // Номер выдаёт БД при вставке: так он уникален и без гонок даже при параллельном оформлении.
        builder.Property(o => o.Number).HasDefaultValueSql($"nextval('{NumberSequence}')");
        builder.HasIndex(o => o.Number).IsUnique();

        builder.Property(o => o.PublicTokenHash).HasMaxLength(64);
        builder.HasIndex(o => o.PublicTokenHash).IsUnique();

        builder.Property(o => o.CustomerName).HasMaxLength(200);
        builder.Property(o => o.CustomerPhone).HasMaxLength(32);
        builder.Property(o => o.CustomerEmail).HasMaxLength(254);

        builder.Property(o => o.DeliveryCity).HasMaxLength(200);
        builder.Property(o => o.DeliveryCityRef).HasMaxLength(64);
        builder.Property(o => o.DeliveryWarehouse).HasMaxLength(300);
        builder.Property(o => o.DeliveryWarehouseRef).HasMaxLength(64);
        builder.Property(o => o.DeliveryAddress).HasMaxLength(500);
        builder.Property(o => o.CustomerComment).HasMaxLength(1000);
        builder.Property(o => o.TrackingNumber).HasMaxLength(40);
        builder.Property(o => o.Locale).HasMaxLength(8).HasDefaultValue("uk");
        builder.Property(o => o.ManagerNote).HasMaxLength(3000);

        builder.Property(o => o.Total).HasPrecision(12, 2);

        builder.HasIndex(o => new { o.UserId, o.CreatedAt });
        builder.HasIndex(o => new { o.Status, o.CreatedAt });
        builder.HasIndex(o => o.CreatedAt);

        // Удаление пользователя не удаляет его заказы: они становятся «гостевыми».
        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.Property(i => i.Sku).HasMaxLength(64);
        builder.Property(i => i.Name).HasMaxLength(300);
        builder.Property(i => i.UnitPrice).HasPrecision(12, 2);
        builder.Property(i => i.LineTotal).HasPrecision(12, 2);

        // Снимок товара: внешнего ключа на Products нет намеренно, только индекс для отчётов.
        builder.HasIndex(i => i.ProductId);
    }
}
