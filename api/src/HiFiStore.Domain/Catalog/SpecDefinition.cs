namespace HiFiStore.Domain.Catalog;

/// <summary>
/// Описание характеристики товаров раздела: «Мощность, Вт», «Тип привода», «Длина, м».
/// Значения конкретного товара хранятся в <see cref="ProductSpec"/>.
/// </summary>
public class SpecDefinition
{
    public Guid Id { get; set; }

    public Guid CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    /// <summary>Машинный ключ для фильтров в URL, например <c>power_w</c>.</summary>
    public required string Key { get; set; }

    public required string Name { get; set; }

    public string? Unit { get; set; }

    public SpecValueType ValueType { get; set; }

    /// <summary>Показывать ли фильтр по этой характеристике в каталоге.</summary>
    public bool IsFilterable { get; set; }

    public int SortOrder { get; set; }
}
