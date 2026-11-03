namespace HiFiStore.Infrastructure.Orders;

public static class EnumNames
{
    /// <summary>
    /// Разбирает имя значения перечисления без учёта регистра. Числа не принимаются:
    /// «0» или «42» прошли бы <see cref="Enum.TryParse{TEnum}(string, bool, out TEnum)"/>, но это не имя.
    /// </summary>
    public static bool TryParse<TEnum>(string? value, out TEnum result)
        where TEnum : struct, Enum
    {
        result = default;
        var trimmed = value?.Trim();
        return !string.IsNullOrEmpty(trimmed) &&
               !char.IsAsciiDigit(trimmed[0]) &&
               trimmed[0] != '-' &&
               Enum.TryParse(trimmed, ignoreCase: true, out result) &&
               Enum.IsDefined(result);
    }

    public static string List<TEnum>()
        where TEnum : struct, Enum => string.Join(", ", Enum.GetNames<TEnum>());
}
