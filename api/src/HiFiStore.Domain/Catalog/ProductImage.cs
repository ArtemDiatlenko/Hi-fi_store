namespace HiFiStore.Domain.Catalog;

public class ProductImage
{
    public Guid Id { get; set; }

    public Guid ProductId { get; set; }

    public required string Url { get; set; }

    public string? Alt { get; set; }

    public int SortOrder { get; set; }
}
