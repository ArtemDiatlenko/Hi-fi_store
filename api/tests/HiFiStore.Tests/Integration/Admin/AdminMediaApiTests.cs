using System.Net;
using System.Net.Http.Headers;
using HiFiStore.Tests.Media;

namespace HiFiStore.Tests.Integration.Admin;

public sealed class AdminMediaApiTests(StoreWebApplicationFactory factory) : AdminApiTestBase(factory)
{
    private const string UploadUrl = "/api/admin/media/images";

    private static MultipartFormDataContent Form(byte[] bytes, string fileName = "photo.jpg", string contentType = "image/jpeg")
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    [SkippableFact]
    public async Task Admin_UploadsImage_AndItIsServedUnderMediaUrl()
    {
        await PrepareAsync();
        byte[] bytes = [.. MediaTests.PngHeader, .. Guid.NewGuid().ToByteArray()];

        // Имя и Content-Type от браузера не важны: формат определяется по содержимому.
        var response = await Admin.PostAsync(UploadUrl, Form(bytes, "photo.jpg", "image/jpeg"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await ReadJsonAsync(response);
        var url = body.GetProperty("url").GetString()!;
        Assert.Matches(@"^/media/products/\d{4}/\d{2}/[0-9a-f]{32}\.png$", url);
        Assert.Equal("image/png", body.GetProperty("contentType").GetString());
        Assert.Equal(url, response.Headers.Location?.OriginalString);

        var served = await Anonymous.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, served.StatusCode);
        Assert.Equal("image/png", served.Content.Headers.ContentType?.MediaType);
        Assert.Equal(bytes, await served.Content.ReadAsByteArrayAsync());
        Assert.Contains("immutable", served.Headers.CacheControl?.ToString());
        Assert.Contains("nosniff", served.Headers.GetValues("X-Content-Type-Options"));
    }

    [SkippableFact]
    public async Task UploadedImage_CanBeAttachedToProduct()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var product = await PostAsync("/api/admin/products", new
        {
            name = $"Товар {suffix}",
            sku = $"SKU-{suffix}",
            price = 1000,
            stock = 1,
            condition = "New",
            brandId = branch.BrandId,
            categoryId = branch.CategoryId,
        });
        var upload = await Admin.PostAsync(UploadUrl, Form([.. MediaTests.JpegHeader, 1, 2, 3]));
        var url = (await ReadJsonAsync(upload)).GetProperty("url").GetString();

        var saved = await PutAsync(
            $"/api/admin/products/{product.GetProperty("id").GetGuid()}/images",
            new { images = new[] { new { url, alt = "Фото" } } });

        Assert.Equal(url, saved.GetProperty("images")[0].GetProperty("url").GetString());
    }

    [SkippableFact]
    public async Task NonImage_IsRejectedWithFieldError()
    {
        await PrepareAsync();

        var response = await Admin.PostAsync(UploadUrl, Form("<html><script>alert(1)</script></html>"u8.ToArray(), "x.jpg"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        AssertFieldErrors(await ReadJsonAsync(response), "file");
    }

    [SkippableFact]
    public async Task MissingFile_IsRejectedWithFieldError()
    {
        await PrepareAsync();

        var withoutFile = await Admin.PostAsync(UploadUrl, new MultipartFormDataContent { { new StringContent("x"), "other" } });
        var notMultipart = await Admin.PostAsync(UploadUrl, new StringContent("{}", null, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, withoutFile.StatusCode);
        AssertFieldErrors(await ReadJsonAsync(withoutFile), "file");
        Assert.Equal(HttpStatusCode.BadRequest, notMultipart.StatusCode);
        AssertFieldErrors(await ReadJsonAsync(notMultipart), "file");
    }

    [SkippableFact]
    public async Task TooLargeFile_IsRejectedWithFieldError()
    {
        await PrepareAsync();
        var bytes = new byte[10 * 1024 * 1024 + 1];
        MediaTests.JpegHeader.CopyTo(bytes, 0);

        var response = await Admin.PostAsync(UploadUrl, Form(bytes));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        AssertFieldErrors(await ReadJsonAsync(response), "file");
    }

    [SkippableFact]
    public async Task Anonymous_And_Customer_CannotUpload()
    {
        await PrepareAsync();
        using var customer = await Factory.CreateCustomerClientAsync();

        var anonymous = await Anonymous.PostAsync(UploadUrl, Form(MediaTests.JpegHeader));
        var forbidden = await customer.PostAsync(UploadUrl, Form(MediaTests.JpegHeader));

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [SkippableTheory]
    [InlineData("/media/products/2026/11/missing.jpg")]
    [InlineData("/media/..%2Fappsettings.json")]
    [InlineData("/media/products/%2E%2E/%2E%2E/appsettings.json")]
    public async Task UnknownOrUnsafeMediaPath_IsNotFound(string url)
    {
        await PrepareAsync();

        var response = await Anonymous.GetAsync(url);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
