namespace HiFiStore.Infrastructure.Media;

/// <summary>Открытый файл из хранилища. Поток закрывает вызывающий (или ответ ASP.NET Core).</summary>
public sealed record MediaFile(Stream Content, string ContentType, long? Length);

/// <summary>
/// Хранилище файлов по ключу вида <c>products/2026/11/&lt;guid&gt;.jpg</c>. Ключи уникальны и не перезаписываются,
/// поэтому файлы можно кэшировать бессрочно.
/// </summary>
public interface IMediaStorage
{
    Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default);

    /// <summary>Файл или null, если его нет.</summary>
    Task<MediaFile?> OpenAsync(string key, CancellationToken ct = default);
}

public static class MediaKeys
{
    /// <summary>Префикс публичного адреса: файл с ключом <c>k</c> доступен по <c>/media/k</c>.</summary>
    public const string UrlPrefix = "/media/";

    /// <summary>
    /// Безопасный ключ: латиница в нижнем регистре, цифры, «-», «_», «.» и «/» между сегментами.
    /// Без «..», пустых сегментов и ведущего «/» — ключ нельзя использовать для выхода из папки хранилища.
    /// </summary>
    public static bool IsValid(string? key)
    {
        if (string.IsNullOrEmpty(key) || key.Length > 300 || key.StartsWith('/') || key.EndsWith('/'))
        {
            return false;
        }

        foreach (var segment in key.Split('/'))
        {
            if (segment.Length == 0 || segment is "." or "..")
            {
                return false;
            }

            foreach (var c in segment)
            {
                if (c is not ((>= 'a' and <= 'z') or (>= '0' and <= '9') or '-' or '_' or '.'))
                {
                    return false;
                }
            }
        }

        return true;
    }

    /// <summary>Новый ключ для изображения товара: <c>products/yyyy/MM/&lt;guid&gt;.ext</c>.</summary>
    public static string NewProductImage(DateTimeOffset now, string extension) =>
        $"products/{now:yyyy}/{now:MM}/{Guid.NewGuid():N}.{extension}";
}
