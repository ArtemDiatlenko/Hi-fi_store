using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace HiFiStore.Infrastructure.Catalog;

/// <summary>
/// Slug — часть URL из строчных латинских букв, цифр и одиночных дефисов (<c>aurora-i-80</c>).
/// Кириллица транслитерируется (<c>«Ламповий підсилювач»</c> → <c>lampoviy-pidsilyuvach</c>),
/// у латиницы отбрасываются диакритические знаки, остальные символы становятся разделителями.
/// </summary>
public static partial class Slugs
{
    private static readonly Dictionary<char, string> Transliteration = new()
    {
        ['а'] = "a", ['б'] = "b", ['в'] = "v", ['г'] = "g", ['д'] = "d", ['е'] = "e", ['ё'] = "e",
        ['ж'] = "zh", ['з'] = "z", ['и'] = "i", ['й'] = "y", ['к'] = "k", ['л'] = "l", ['м'] = "m",
        ['н'] = "n", ['о'] = "o", ['п'] = "p", ['р'] = "r", ['с'] = "s", ['т'] = "t", ['у'] = "u",
        ['ф'] = "f", ['х'] = "kh", ['ц'] = "ts", ['ч'] = "ch", ['ш'] = "sh", ['щ'] = "shch",
        ['ъ'] = "", ['ы'] = "y", ['ь'] = "", ['э'] = "e", ['ю'] = "yu", ['я'] = "ya",

        // Украинские и белорусские буквы.
        ['є'] = "ye", ['і'] = "i", ['ї'] = "yi", ['ґ'] = "g", ['ў'] = "u",

        // Латинские буквы, которые не раскладываются на букву и диакритику.
        ['ß'] = "ss", ['æ'] = "ae", ['œ'] = "oe", ['ø'] = "o", ['ł'] = "l", ['đ'] = "d", ['þ'] = "th",
    };

    /// <summary>Проверяет формат slug: строчные латинские буквы, цифры, дефисы между ними.</summary>
    public static bool IsValid(string? slug) => slug is not null && SlugPattern().IsMatch(slug);

    /// <summary>
    /// Формирует slug из произвольного текста, например названия товара. Результат не длиннее
    /// <paramref name="maxLength"/> символов; пустая строка, если в тексте нет ни букв, ни цифр.
    /// </summary>
    public static string Generate(string? text, int maxLength = 100)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(maxLength, 1);

        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var result = new StringBuilder(text.Length);
        var separatorPending = false;

        foreach (var ch in text.ToLowerInvariant())
        {
            var piece = Transliterate(ch);
            if (piece is null)
            {
                // Разделитель: несколько подряд дают один дефис, в начале строки — ни одного.
                separatorPending = result.Length > 0;
                continue;
            }

            if (piece.Length == 0)
            {
                continue;
            }

            if (separatorPending)
            {
                result.Append('-');
                separatorPending = false;
            }

            result.Append(piece);
        }

        var slug = result.ToString();
        return slug.Length <= maxLength ? slug : slug[..maxLength].TrimEnd('-');
    }

    /// <summary>Латинская запись символа; пустая строка — пропустить (ъ, ь); <c>null</c> — разделитель.</summary>
    private static string? Transliterate(char ch)
    {
        if (ch is >= 'a' and <= 'z' or >= '0' and <= '9')
        {
            return ch.ToString();
        }

        if (Transliteration.TryGetValue(ch, out var mapped))
        {
            return mapped;
        }

        if (ch < 128 || !char.IsLetter(ch))
        {
            return null;
        }

        // «é» → «e» + диакритика: оставляем только базовую латинскую букву.
        var baseLetters = ch.ToString()
            .Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .Where(c => c is >= 'a' and <= 'z')
            .ToArray();

        return baseLetters.Length > 0 ? new string(baseLetters) : null;
    }

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();
}
