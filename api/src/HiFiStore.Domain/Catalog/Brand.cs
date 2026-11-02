namespace HiFiStore.Domain.Catalog;

public class Brand
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public required string Slug { get; set; }

    public string? Country { get; set; }

    public List<Product> Products { get; set; } = [];
}
