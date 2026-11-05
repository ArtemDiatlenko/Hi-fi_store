namespace HiFiStore.Domain.Catalog;

/// <summary>
/// Языки контента каталога. Основной язык (<see cref="Base"/>) хранится в самих полях сущностей
/// (<c>Product.Name</c> и т. д.), остальные — в таблицах переводов. Если перевода нет, показывается основной текст.
/// </summary>
public static class ContentLocales
{
    public const string Base = "uk";

    /// <summary>Языки, на которые можно перевести контент. Чтобы добавить язык, достаточно дописать его сюда.</summary>
    public static readonly IReadOnlyList<string> Translated = ["en"];

    public static bool IsTranslated(string? locale) => locale is not null && Translated.Contains(locale);

    /// <summary>Язык из запроса: поддерживаемый перевод или основной.</summary>
    public static string Resolve(string? locale)
    {
        var value = locale?.Trim().ToLowerInvariant();
        return IsTranslated(value) ? value! : Base;
    }
}

public class ProductTranslation
{
    public Guid ProductId { get; set; }

    public required string Locale { get; set; }

    public required string Name { get; set; }

    public string? ShortDescription { get; set; }

    public string? Description { get; set; }
}

public class CategoryTranslation
{
    public Guid CategoryId { get; set; }

    public required string Locale { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }
}

public class SpecDefinitionTranslation
{
    public Guid SpecDefinitionId { get; set; }

    public required string Locale { get; set; }

    public required string Name { get; set; }

    public string? Unit { get; set; }
}

/// <summary>
/// Перевод текстового значения характеристики («Дерево» → «Wood»). Фильтры каталога по-прежнему работают
/// по основному значению, перевод — только подпись.
/// </summary>
public class ProductSpecTranslation
{
    public Guid ProductId { get; set; }

    public Guid SpecDefinitionId { get; set; }

    public required string Locale { get; set; }

    public required string TextValue { get; set; }
}
