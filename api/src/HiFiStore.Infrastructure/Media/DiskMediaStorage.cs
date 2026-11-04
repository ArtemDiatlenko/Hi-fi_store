namespace HiFiStore.Infrastructure.Media;

/// <summary>
/// Файлы в папке на сервере. Для разработки и для своего сервера с постоянным диском.
/// На хостингах без постоянного диска (бесплатный Render) файлы пропадут при перезапуске — там нужен S3.
/// </summary>
public sealed class DiskMediaStorage(string root) : IMediaStorage
{
    public string Root { get; } = Path.GetFullPath(root);

    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        // Сначала во временный файл: оборванная загрузка не оставит полфайла под настоящим именем.
        var temp = path + ".part";
        try
        {
            await using (var file = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                await content.CopyToAsync(file, ct);
            }

            File.Move(temp, path);
        }
        finally
        {
            File.Delete(temp);
        }
    }

    public Task<MediaFile?> OpenAsync(string key, CancellationToken ct = default)
    {
        var path = PathFor(key);
        if (!File.Exists(path))
        {
            return Task.FromResult<MediaFile?>(null);
        }

        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return Task.FromResult<MediaFile?>(new MediaFile(stream, ImageFormats.ContentTypeForKey(key), stream.Length));
    }

    private string PathFor(string key)
    {
        if (!MediaKeys.IsValid(key))
        {
            throw new ArgumentException("Недопустимый ключ файла.", nameof(key));
        }

        // Ключ уже проверен, но путь всё равно должен оставаться внутри папки хранилища.
        var path = Path.GetFullPath(Path.Combine(Root, key));
        if (!path.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            throw new ArgumentException("Недопустимый ключ файла.", nameof(key));
        }

        return path;
    }
}
