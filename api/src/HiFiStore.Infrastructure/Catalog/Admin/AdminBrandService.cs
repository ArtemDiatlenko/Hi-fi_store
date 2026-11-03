using System.Linq.Expressions;
using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Catalog.Admin;

public sealed class AdminBrandService(StoreDbContext db) : IAdminBrandService
{
    // Совпадают с ограничениями в BrandConfiguration.
    private const int NameMaxLength = 200;
    private const int SlugMaxLength = 200;
    private const int CountryMaxLength = 100;

    private static readonly AdminError NotFound = AdminError.NotFound("Бренд не найден.");

    private static readonly Expression<Func<Brand, AdminBrandDto>> ToDto =
        b => new AdminBrandDto(b.Id, b.Name, b.Slug, b.Country, b.Products.Count);

    public async Task<IReadOnlyList<AdminBrandDto>> ListAsync(CancellationToken ct = default) =>
        await db.Brands.AsNoTracking()
            .OrderBy(b => b.Name)
            .Select(ToDto)
            .ToListAsync(ct);

    public async Task<AdminResult<AdminBrandDto>> GetAsync(Guid id, CancellationToken ct = default)
    {
        var brand = await db.Brands.AsNoTracking()
            .Where(b => b.Id == id)
            .Select(ToDto)
            .FirstOrDefaultAsync(ct);

        return brand is null ? NotFound : brand;
    }

    public Task<AdminResult<AdminBrandDto>> CreateAsync(BrandRequest request, CancellationToken ct = default) =>
        SaveAsync(null, request, ct);

    public Task<AdminResult<AdminBrandDto>> UpdateAsync(Guid id, BrandRequest request, CancellationToken ct = default) =>
        SaveAsync(id, request, ct);

    public async Task<AdminResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var brand = await db.Brands.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (brand is null)
        {
            return NotFound;
        }

        var productCount = await db.Products.CountAsync(p => p.BrandId == id, ct);
        if (productCount > 0)
        {
            return AdminError.Conflict(
                $"Нельзя удалить бренд «{brand.Name}»: у него есть товары ({productCount}). " +
                "Сначала удалите эти товары или укажите у них другой бренд.");
        }

        db.Brands.Remove(brand);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (DbErrors.IsForeignKeyViolation(ex))
        {
            return AdminError.Conflict($"Нельзя удалить бренд «{brand.Name}»: у него появились товары.");
        }

        return AdminResult.Success;
    }

    private async Task<AdminResult<AdminBrandDto>> SaveAsync(Guid? id, BrandRequest request, CancellationToken ct)
    {
        Brand? brand = null;
        if (id is not null)
        {
            brand = await db.Brands.FirstOrDefaultAsync(b => b.Id == id, ct);
            if (brand is null)
            {
                return NotFound;
            }
        }

        var errors = new ValidationErrors();
        var name = errors.Required("name", request.Name, NameMaxLength, "Укажите название бренда.");
        var slug = errors.ResolveSlug(request.Slug, name, brand?.Slug, SlugMaxLength);
        var country = errors.Optional("country", request.Country, CountryMaxLength);
        if (errors.HasErrors)
        {
            return errors.ToError();
        }

        if (await db.Brands.AnyAsync(b => b.Slug == slug && b.Id != id, ct))
        {
            return SlugTaken(slug);
        }

        if (brand is null)
        {
            brand = new Brand { Id = Guid.NewGuid(), Name = name, Slug = slug };
            db.Brands.Add(brand);
        }

        brand.Name = name;
        brand.Slug = slug;
        brand.Country = country;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            return SlugTaken(slug);
        }

        return await GetAsync(brand.Id, ct);
    }

    private static AdminError SlugTaken(string slug) =>
        AdminError.Conflict($"Бренд со slug «{slug}» уже существует. Укажите другой slug.");
}
