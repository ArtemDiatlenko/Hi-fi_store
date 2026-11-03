namespace HiFiStore.Domain.Catalog;

public class Product
{
    public Guid Id { get; set; }

    /// <summary>Артикул магазина.</summary>
    public required string Sku { get; set; }

    public required string Name { get; set; }

    public required string Slug { get; set; }

    public string? ShortDescription { get; set; }

    public string Description { get; set; } = string.Empty;

    /// <summary>Цена в валюте магазина (см. настройку <c>Store:Currency</c>).</summary>
    public decimal Price { get; set; }

    /// <summary>Старая цена для отображения скидки. <c>null</c>, если скидки нет.</summary>
    public decimal? OldPrice { get; set; }

    public int Stock { get; set; }

    public ProductCondition Condition { get; set; } = ProductCondition.New;

    /// <summary>Неопубликованные товары не видны на витрине.</summary>
    public bool IsPublished { get; set; }

    public Guid CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    public Guid BrandId { get; set; }

    public Brand Brand { get; set; } = null!;

    public List<ProductImage> Images { get; set; } = [];

    public List<ProductSpec> Specs { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
