using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Persistence;
using HiFiStore.Infrastructure.Persistence.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Integration;

/// <summary>
/// Обновление фото в уже заполненном демо-каталоге. Использует товары, которые не проверяют другие тесты
/// (тесты идут параллельно на общей базе).
/// </summary>
public sealed class DemoCatalogImagesTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    [SkippableFact]
    public async Task UpgradeLegacyImages_ReplacesOnlyPlaceholderImages()
    {
        await factory.PrepareAsync();
        await SetImagesAsync("vega-floor-3", "https://placehold.co/800x600/png?text=Vega");
        await SetImagesAsync("liniya-tower-9", "/images/my-real-photo.jpg");

        using (var scope = factory.Services.CreateScope())
        {
            await DemoCatalog.UpgradeLegacyImagesAsync(scope.ServiceProvider.GetRequiredService<StoreDbContext>());
        }

        Assert.Equal(
            ["/demo/products/vega-floor-3-1.svg", "/demo/products/vega-floor-3-2.svg", "/demo/products/vega-floor-3-3.svg"],
            await ImageUrlsAsync("vega-floor-3"));
        Assert.Equal(["/images/my-real-photo.jpg"], await ImageUrlsAsync("liniya-tower-9"));
    }

    private async Task SetImagesAsync(string slug, string url)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        var product = await db.Products.Include(p => p.Images).SingleAsync(p => p.Slug == slug);
        db.ProductImages.RemoveRange(product.Images);
        db.ProductImages.Add(new ProductImage { Id = Guid.NewGuid(), ProductId = product.Id, Url = url, SortOrder = 0 });
        await db.SaveChangesAsync();
    }

    private async Task<string[]> ImageUrlsAsync(string slug)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        return await db.Products.AsNoTracking()
            .Where(p => p.Slug == slug)
            .SelectMany(p => p.Images)
            .OrderBy(i => i.SortOrder)
            .Select(i => i.Url)
            .ToArrayAsync();
    }
}
