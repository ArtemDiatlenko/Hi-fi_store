using System.Net;
using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace HiFiStore.Infrastructure.Media;

/// <summary>
/// Любое S3-совместимое хранилище: Cloudflare R2, Amazon S3, Backblaze B2, MinIO и т. п.
/// Бакет не обязан быть публичным: файлы отдаёт API.
/// </summary>
public sealed class S3MediaStorage : IMediaStorage, IDisposable
{
    private readonly IAmazonS3 _client;
    private readonly string _bucket;

    public S3MediaStorage(S3MediaOptions options)
    {
        _bucket = options.Bucket!;
        var config = new AmazonS3Config
        {
            ForcePathStyle = options.ForcePathStyle,
            // Контрольные суммы только там, где их требует S3: R2 и часть S3-совместимых хранилищ
            // не поддерживают новые заголовки CRC, которые SDK 4.x добавляет по умолчанию.
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
        };
        if (string.IsNullOrWhiteSpace(options.ServiceUrl))
        {
            config.RegionEndpoint = RegionEndpoint.GetBySystemName(options.Region);
        }
        else
        {
            config.ServiceURL = options.ServiceUrl;
            config.AuthenticationRegion = options.Region;
        }

        _client = new AmazonS3Client(new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey), config);
    }

    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        EnsureValid(key);
        var request = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            AutoCloseStream = false,
            // Тело не подписываем отдельно (передача и так по HTTPS): так рекомендует Cloudflare для R2.
            DisablePayloadSigning = true,
            UseChunkEncoding = false,
        };
        await _client.PutObjectAsync(request, ct);
    }

    public async Task<MediaFile?> OpenAsync(string key, CancellationToken ct = default)
    {
        EnsureValid(key);
        try
        {
            var response = await _client.GetObjectAsync(_bucket, key, ct);
            var contentType = string.IsNullOrEmpty(response.Headers.ContentType)
                ? ImageFormats.ContentTypeForKey(key)
                : response.Headers.ContentType;
            return new MediaFile(response.ResponseStream, contentType, response.ContentLength);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public void Dispose() => _client.Dispose();

    private static void EnsureValid(string key)
    {
        if (!MediaKeys.IsValid(key))
        {
            throw new ArgumentException("Недопустимый ключ файла.", nameof(key));
        }
    }

    /// <summary>Ошибки настройки, которые видны до первого запроса к хранилищу.</summary>
    public static void Validate(S3MediaOptions options)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(options.Bucket)) missing.Add("Media:S3:Bucket");
        if (string.IsNullOrWhiteSpace(options.AccessKeyId)) missing.Add("Media:S3:AccessKeyId");
        if (string.IsNullOrWhiteSpace(options.SecretAccessKey)) missing.Add("Media:S3:SecretAccessKey");
        if (missing.Count > 0)
        {
            throw new InvalidOperationException($"Media:Provider=S3, но не заданы: {string.Join(", ", missing)}.");
        }

        if (!string.IsNullOrWhiteSpace(options.ServiceUrl) &&
            !(Uri.TryCreate(options.ServiceUrl, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https"))
        {
            throw new InvalidOperationException("Media:S3:ServiceUrl должен быть адресом http(s).");
        }
    }
}
