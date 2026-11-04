using HiFiStore.Infrastructure.Media;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace HiFiStore.Api.Controllers;

/// <summary>
/// Загруженные файлы: <c>GET /media/{key}</c> из хранилища, заданного настройкой <c>Media:Provider</c>.
/// Витрина проксирует <c>/media/*</c> сюда, поэтому адрес в базе не зависит от хранилища.
/// </summary>
[ApiController]
public sealed class MediaController(IMediaStorage storage) : ControllerBase
{
    [HttpGet("/media/{**key}")]
    [HttpHead("/media/{**key}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(string key, CancellationToken ct)
    {
        if (!MediaKeys.IsValid(key))
        {
            return NotFound();
        }

        var file = await storage.OpenAsync(key, ct);
        if (file is null)
        {
            return NotFound();
        }

        // Ключ уникален и не перезаписывается — файл можно кэшировать бессрочно (браузер, CDN, next/image).
        Response.Headers[HeaderNames.CacheControl] = "public, max-age=31536000, immutable";
        Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
        return File(file.Content, file.ContentType);
    }
}
