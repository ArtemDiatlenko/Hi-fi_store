namespace HiFiStore.Infrastructure.Catalog.Admin;

/// <summary>
/// Управление товарами в админке. В отличие от витрины видит и неопубликованные товары.
/// <c>UpdatedAt</c> обновляется при каждом изменении товара, его характеристик, изображений или публикации.
/// </summary>
public interface IAdminProductService
{
    /// <summary>Товары по дате изменения, новые сверху.</summary>
    Task<PagedResult<AdminProductListItem>> ListAsync(AdminProductQuery query, CancellationToken ct = default);

    Task<AdminResult<AdminProductDetails>> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Создаёт неопубликованный товар. Без <c>slug</c> он формируется из названия.
    /// Ошибки: валидация (400), занятые slug или артикул (409).
    /// </summary>
    Task<AdminResult<AdminProductDetails>> CreateAsync(ProductRequest request, CancellationToken ct = default);

    /// <summary>
    /// Изменяет основные поля товара; без <c>slug</c> slug не меняется. При смене раздела удаляются значения
    /// характеристик, которых нет у нового раздела и его предков.
    /// </summary>
    Task<AdminResult<AdminProductDetails>> UpdateAsync(Guid id, ProductRequest request, CancellationToken ct = default);

    /// <summary>Удаляет товар с изображениями и характеристиками; если на товар ссылаются другие записи — 409.</summary>
    Task<AdminResult> DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Заменяет характеристики товара. Ключ должен принадлежать разделу товара или его предкам,
    /// значение — соответствовать типу характеристики; иначе 400 с ошибкой в поле <c>specs.{ключ}</c>.
    /// </summary>
    Task<AdminResult<AdminProductDetails>> SetSpecsAsync(Guid id, SetProductSpecsRequest request, CancellationToken ct = default);

    /// <summary>Заменяет изображения товара; порядок в запросе становится порядком показа.</summary>
    Task<AdminResult<AdminProductDetails>> SetImagesAsync(Guid id, SetProductImagesRequest request, CancellationToken ct = default);

    /// <summary>Публикует товар на витрине или снимает с публикации.</summary>
    Task<AdminResult<AdminProductDetails>> SetPublishedAsync(Guid id, bool published, CancellationToken ct = default);
}
