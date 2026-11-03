namespace HiFiStore.Domain.Catalog;

/// <summary>
/// Состояние товара. В hi-fi часто продают б/у и демо-образцы, поэтому это отдельное поле.
/// </summary>
public enum ProductCondition
{
    New = 0,
    Used = 1,
    Demo = 2,
}
