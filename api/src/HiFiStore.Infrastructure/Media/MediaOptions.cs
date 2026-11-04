namespace HiFiStore.Infrastructure.Media;

/// <summary>
/// Хранилище загруженных файлов (секция <c>Media</c>). Disk — папка на сервере (для разработки и своего сервера
/// с постоянным диском), S3 — любое S3-совместимое хранилище: Cloudflare R2, Amazon S3, Backblaze B2, MinIO и т. п.
/// <para>
/// В базе хранится адрес вида <c>/media/products/...</c>, не зависящий от хранилища: файлы отдаёт API
/// (<c>GET /media/...</c>). Смена хранилища — перенос файлов и новые настройки, адреса в базе не меняются.
/// </para>
/// </summary>
public sealed class MediaOptions
{
    public const string Section = "Media";

    /// <summary>Disk (по умолчанию) или S3.</summary>
    public string Provider { get; set; } = "Disk";

    /// <summary>Наибольший размер загружаемого изображения в байтах. По умолчанию 10 МБ.</summary>
    public long MaxImageBytes { get; set; } = 10 * 1024 * 1024;

    public DiskMediaOptions Disk { get; set; } = new();

    public S3MediaOptions S3 { get; set; } = new();
}

public sealed class DiskMediaOptions
{
    /// <summary>Папка с файлами. Относительный путь считается от каталога приложения (content root).</summary>
    public string Path { get; set; } = "media";
}

public sealed class S3MediaOptions
{
    /// <summary>
    /// Адрес S3 API. Для Cloudflare R2: <c>https://&lt;account-id&gt;.r2.cloudflarestorage.com</c>.
    /// Пусто — Amazon S3 в регионе <see cref="Region"/>.
    /// </summary>
    public string? ServiceUrl { get; set; }

    public string? Bucket { get; set; }

    /// <summary>Для R2 — <c>auto</c>.</summary>
    public string Region { get; set; } = "auto";

    /// <summary>Задаётся через Media__S3__AccessKeyId.</summary>
    public string? AccessKeyId { get; set; }

    /// <summary>Задаётся через Media__S3__SecretAccessKey.</summary>
    public string? SecretAccessKey { get; set; }

    /// <summary>Адреса вида <c>endpoint/bucket/key</c>. Нужно R2 и MinIO; для Amazon S3 можно выключить.</summary>
    public bool ForcePathStyle { get; set; } = true;
}
