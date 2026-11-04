namespace HiFiStore.Domain.Catalog;

/// <summary>
/// Значение характеристики у товара. Заполняется одно поле в зависимости от
/// <see cref="SpecDefinition.ValueType"/>: так числовые значения можно фильтровать диапазоном.
/// </summary>
public class ProductSpec
{
    public Guid ProductId { get; set; }

    public Product Product { get; set; } = null!;

    public Guid SpecDefinitionId { get; set; }

    public SpecDefinition SpecDefinition { get; set; } = null!;

    public string? TextValue { get; set; }

    public decimal? NumberValue { get; set; }

    public bool? BoolValue { get; set; }

    /// <summary>Переводы текстового значения.</summary>
    public List<ProductSpecTranslation> Translations { get; set; } = [];
}
