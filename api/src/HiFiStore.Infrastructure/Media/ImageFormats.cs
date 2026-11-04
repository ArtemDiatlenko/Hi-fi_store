namespace HiFiStore.Infrastructure.Media;

public sealed record ImageFormat(string Extension, string ContentType);

/// <summary>
/// Формат изображения по первым байтам файла, а не по имени или Content-Type от браузера:
/// их легко подделать, а под видом картинки нельзя загрузить HTML или скрипт.
/// </summary>
public static class ImageFormats
{
    public static readonly ImageFormat Jpeg = new("jpg", "image/jpeg");
    public static readonly ImageFormat Png = new("png", "image/png");
    public static readonly ImageFormat Webp = new("webp", "image/webp");

    /// <summary>Сколько байт начала файла нужно для определения формата.</summary>
    public const int HeaderLength = 12;

    public static ImageFormat? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
        {
            return Jpeg;
        }

        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return Png;
        }

        // RIFF....WEBP
        if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8))
        {
            return Webp;
        }

        return null;
    }

    /// <summary>Content-Type по расширению ключа — для отдачи файлов с диска.</summary>
    public static string ContentTypeForKey(string key) => Path.GetExtension(key).ToLowerInvariant() switch
    {
        ".jpg" or ".jpeg" => Jpeg.ContentType,
        ".png" => Png.ContentType,
        ".webp" => Webp.ContentType,
        _ => "application/octet-stream",
    };
}
