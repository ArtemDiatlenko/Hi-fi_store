using System.Text.Json;
using HiFiStore.Domain.Catalog;

namespace HiFiStore.Infrastructure.Catalog.Admin;

// Запросы. Поля сделаны необязательными для десериализации: обязательность и формат проверяет сервис,
// чтобы ошибки по полям приходили единообразно и на русском языке.

/// <summary>Создание или изменение бренда. Без <c>slug</c> при создании он формируется из названия.</summary>
public sealed record BrandRequest(string? Name, string? Slug, string? Country);

/// <summary>
/// Создание или изменение раздела. <c>ParentId = null</c> — раздел верхнего уровня;
/// при изменении так раздел переносится в корень.
/// </summary>
public sealed record CategoryRequest(string? Name, string? Slug, string? Description, Guid? ParentId, int SortOrder = 0);

/// <summary>Описание характеристики раздела.</summary>
public sealed record SpecDefinitionRequest(
    string? Key,
    string? Name,
    string? Unit,
    SpecValueType? ValueType,
    bool IsFilterable = false,
    int SortOrder = 0);

/// <summary>
/// Основные поля товара. Новый товар создаётся неопубликованным; характеристики, изображения
/// и публикация меняются отдельными запросами. Изменение заменяет все поля: незаданные необязательные
/// получают значения по умолчанию (остаток 0, состояние <c>New</c>, без старой цены), кроме slug — он сохраняется.
/// </summary>
public sealed record ProductRequest(
    string? Sku,
    string? Name,
    string? Slug,
    string? ShortDescription,
    string? Description,
    decimal? Price,
    decimal? OldPrice,
    int? Stock,
    ProductCondition? Condition,
    Guid? CategoryId,
    Guid? BrandId);

/// <summary>
/// Полный набор характеристик товара: ключ характеристики → значение (число, строка или true/false
/// в зависимости от типа). Характеристики, которых нет в наборе (или со значением <c>null</c>), удаляются.
/// </summary>
public sealed record SetProductSpecsRequest(IReadOnlyDictionary<string, JsonElement>? Specs);

public sealed record ProductImageRequest(string? Url, string? Alt);

/// <summary>Полный упорядоченный список изображений товара; пустой список удаляет все изображения.</summary>
public sealed record SetProductImagesRequest(IReadOnlyList<ProductImageRequest?>? Images);

/// <summary>Параметры списка товаров в админке. Все условия объединяются через AND.</summary>
public sealed record AdminProductQuery
{
    /// <summary>Подстрока названия или артикула, без учёта регистра.</summary>
    public string? Search { get; init; }

    /// <summary>Раздел, включая вложенные разделы.</summary>
    public Guid? CategoryId { get; init; }

    public Guid? BrandId { get; init; }

    /// <summary><c>true</c> — только опубликованные, <c>false</c> — только неопубликованные, <c>null</c> — все.</summary>
    public bool? IsPublished { get; init; }

    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = 20;
}

// Ответы.

public sealed record AdminBrandDto(Guid Id, string Name, string Slug, string? Country, int ProductCount);

/// <summary>Раздел в плоском списке. Порядок списка — обход дерева в глубину, так что его можно сразу выводить с отступами.</summary>
public sealed record AdminCategoryDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    Guid? ParentId,
    int SortOrder,
    int ChildCount,
    int ProductCount);

public sealed record AdminSpecDefinitionDto(
    Guid Id,
    Guid CategoryId,
    string Key,
    string Name,
    string? Unit,
    SpecValueType ValueType,
    bool IsFilterable,
    int SortOrder);

/// <summary>Раздел с собственными характеристиками (без унаследованных от родительских разделов).</summary>
public sealed record AdminCategoryDetails(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    Guid? ParentId,
    int SortOrder,
    int ChildCount,
    int ProductCount,
    IReadOnlyList<AdminSpecDefinitionDto> Specs);

public sealed record AdminRef(Guid Id, string Name, string Slug);

public sealed record AdminProductListItem(
    Guid Id,
    string Sku,
    string Name,
    string Slug,
    decimal Price,
    decimal? OldPrice,
    int Stock,
    ProductCondition Condition,
    bool IsPublished,
    AdminRef Brand,
    AdminRef Category,
    string? ImageUrl,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Товар со всеми данными для редактирования. <see cref="AvailableSpecs"/> — характеристики, которые можно задать
/// товару: раздела товара и его родительских разделов.
/// </summary>
public sealed record AdminProductDetails(
    Guid Id,
    string Sku,
    string Name,
    string Slug,
    string? ShortDescription,
    string Description,
    decimal Price,
    decimal? OldPrice,
    int Stock,
    ProductCondition Condition,
    bool IsPublished,
    AdminRef Brand,
    AdminRef Category,
    IReadOnlyList<ImageDto> Images,
    IReadOnlyList<SpecValueDto> Specs,
    IReadOnlyList<AdminSpecDefinitionDto> AvailableSpecs,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
