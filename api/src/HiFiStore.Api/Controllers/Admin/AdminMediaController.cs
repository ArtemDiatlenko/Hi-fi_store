using HiFiStore.Infrastructure.Catalog.Admin;
using HiFiStore.Infrastructure.Media;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers.Admin;

/// <summary>
/// Загрузка фото товаров. Ответ — адрес <c>/media/...</c>; к товару фото привязывается сохранением
/// списка изображений (<c>PUT /api/admin/products/{id}/images</c>).
/// </summary>
[Route("api/admin/media")]
public sealed class AdminMediaController(ProductImageUploader uploader, MediaOptions options) : AdminControllerBase
{
    /// <summary>Запас на служебные части multipart-запроса сверх размера самого файла.</summary>
    private const long MultipartOverhead = 64 * 1024;

    /// <summary><c>multipart/form-data</c> с полем <c>file</c>: JPEG, PNG или WebP, по умолчанию до 10 МБ.</summary>
    [HttpPost("images")]
    [ProducesResponseType<UploadedImage>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UploadImage(CancellationToken ct)
    {
        var limit = options.MaxImageBytes + MultipartOverhead;
        if (Request.ContentLength > limit)
        {
            return TooLarge();
        }

        // Лимит тела запроса Kestrel — по настройке хранилища, а не общий 30 МБ.
        if (HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } bodyLimit)
        {
            bodyLimit.MaxRequestBodySize = limit;
        }

        if (!Request.HasFormContentType)
        {
            return FileError("Отправьте файл в поле «file» (multipart/form-data).");
        }

        IFormFile? file;
        try
        {
            var form = await Request.ReadFormAsync(ct);
            file = form.Files.GetFile(ProductImageUploader.FileField);
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return TooLarge();
        }
        catch (InvalidDataException)
        {
            return FileError("Не удалось прочитать файл. Попробуйте загрузить его ещё раз.");
        }

        if (file is null)
        {
            return FileError("Выберите файл изображения.");
        }

        await using var content = file.OpenReadStream();
        return FromResult(
            await uploader.UploadAsync(content, file.Length, ct),
            image => Created(image.Url, image));
    }

    private IActionResult TooLarge() => FileError(ProductImageUploader.TooLargeMessage(options.MaxImageBytes));

    private IActionResult FileError(string message) => ValidationProblem(
        new ValidationProblemDetails(new Dictionary<string, string[]> { [ProductImageUploader.FileField] = [message] })
        {
            Detail = "Проверьте введённые данные.",
        });
}
