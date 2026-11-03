namespace HiFiStore.Infrastructure.Catalog.Admin;

/// <summary>Управление брендами в админке.</summary>
public interface IAdminBrandService
{
    /// <summary>Все бренды по названию.</summary>
    Task<IReadOnlyList<AdminBrandDto>> ListAsync(CancellationToken ct = default);

    Task<AdminResult<AdminBrandDto>> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>Ошибки: валидация (400), занятый slug (409).</summary>
    Task<AdminResult<AdminBrandDto>> CreateAsync(BrandRequest request, CancellationToken ct = default);

    /// <summary>Без <c>slug</c> в запросе slug не меняется. Ошибки: нет бренда (404), валидация (400), занятый slug (409).</summary>
    Task<AdminResult<AdminBrandDto>> UpdateAsync(Guid id, BrandRequest request, CancellationToken ct = default);

    /// <summary>Бренд с товарами не удаляется (409).</summary>
    Task<AdminResult> DeleteAsync(Guid id, CancellationToken ct = default);
}
