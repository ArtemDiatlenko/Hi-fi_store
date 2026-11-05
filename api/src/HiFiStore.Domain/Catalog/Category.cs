namespace HiFiStore.Domain.Catalog;

/// <summary>
/// Раздел каталога. Разделы образуют дерево: например, «Кабели» → «Межблочные».
/// </summary>
public class Category
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    /// <summary>Часть URL, уникальная в пределах каталога.</summary>
    public required string Slug { get; set; }

    public string? Description { get; set; }

    public Guid? ParentId { get; set; }

    public Category? Parent { get; set; }

    public List<Category> Children { get; set; } = [];

    /// <summary>
    /// Характеристики, которые есть у товаров этого раздела
    /// (у усилителя — мощность, у кабеля — длина и т. д.).
    /// </summary>
    public List<SpecDefinition> Specs { get; set; } = [];

    public List<CategoryTranslation> Translations { get; set; } = [];

    public int SortOrder { get; set; }
}
