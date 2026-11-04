using HiFiStore.Infrastructure.Catalog.Admin;

namespace HiFiStore.Infrastructure.Media;

/// <summary>Загруженное изображение: адрес для поля <c>images[].url</c> товара.</summary>
public sealed record UploadedImage(string Url, string ContentType, long Size);

/// <summary>
/// Загрузка фото товара из админки: проверка формата и размера, сохранение под новым уникальным ключом.
/// К товару фото привязывается отдельно — сохранением списка изображений (<c>PUT .../images</c>).
/// </summary>
public sealed class ProductImageUploader(IMediaStorage storage, MediaOptions options, TimeProvider time)
{
    public const string FileField = "file";

    /// <param name="content">Поток с возможностью перемотки (файл формы ASP.NET Core).</param>
    /// <param name="length">Размер файла в байтах.</param>
    public async Task<AdminResult<UploadedImage>> UploadAsync(Stream content, long length, CancellationToken ct = default)
    {
        if (length <= 0)
        {
            return AdminError.Validation(FileField, "Выберите файл изображения.");
        }

        if (length > options.MaxImageBytes)
        {
            return AdminError.Validation(FileField, TooLargeMessage(options.MaxImageBytes));
        }

        var header = new byte[ImageFormats.HeaderLength];
        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        var format = ImageFormats.Detect(header.AsSpan(0, read));
        if (format is null)
        {
            return AdminError.Validation(FileField, "Поддерживаются изображения JPEG, PNG и WebP.");
        }

        content.Position = 0;
        var key = MediaKeys.NewProductImage(time.GetUtcNow(), format.Extension);
        await storage.SaveAsync(key, content, format.ContentType, ct);
        return new UploadedImage(MediaKeys.UrlPrefix + key, format.ContentType, length);
    }

    public static string TooLargeMessage(long maxBytes) =>
        $"Файл больше {maxBytes / (1024 * 1024)} МБ. Уменьшите фото или сохраните его с меньшим качеством.";
}
