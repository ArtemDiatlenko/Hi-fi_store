using HiFiStore.Infrastructure;
using HiFiStore.Infrastructure.Media;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Media;

public sealed class MediaTests : IDisposable
{
    internal static readonly byte[] JpegHeader = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];
    internal static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];
    internal static readonly byte[] WebpHeader = [.. "RIFF"u8, 0x24, 0x00, 0x00, 0x00, .. "WEBP"u8];

    private readonly string _root = Path.Combine(Path.GetTempPath(), "hifistore-media-tests", Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, recursive: true);
        }
    }

    [Fact]
    public void Detect_RecognisesSupportedFormatsByContent()
    {
        Assert.Equal(ImageFormats.Jpeg, ImageFormats.Detect(JpegHeader));
        Assert.Equal(ImageFormats.Png, ImageFormats.Detect(PngHeader));
        Assert.Equal(ImageFormats.Webp, ImageFormats.Detect(WebpHeader));
    }

    [Theory]
    [InlineData("<html><script>alert(1)</script>")]
    [InlineData("GIF89a............")]
    [InlineData("")]
    public void Detect_RejectsOtherContent(string content)
    {
        Assert.Null(ImageFormats.Detect(System.Text.Encoding.ASCII.GetBytes(content)));
    }

    [Theory]
    [InlineData("products/2026/11/abc.jpg", true)]
    [InlineData("products/a_b-c.webp", true)]
    [InlineData("../secret.txt", false)]
    [InlineData("products/../../etc/passwd", false)]
    [InlineData("/products/a.jpg", false)]
    [InlineData("products//a.jpg", false)]
    [InlineData("products/a.jpg/", false)]
    [InlineData("products/A.jpg", false)]
    [InlineData("products\\a.jpg", false)]
    [InlineData("products/%2e%2e/a.jpg", false)]
    [InlineData("", false)]
    public void IsValid_AllowsOnlySafeKeys(string key, bool expected)
    {
        Assert.Equal(expected, MediaKeys.IsValid(key));
    }

    [Fact]
    public void NewProductImage_IsUniqueAndValid()
    {
        var now = new DateTimeOffset(2026, 11, 4, 12, 0, 0, TimeSpan.Zero);

        var first = MediaKeys.NewProductImage(now, "jpg");
        var second = MediaKeys.NewProductImage(now, "jpg");

        Assert.StartsWith("products/2026/11/", first);
        Assert.EndsWith(".jpg", first);
        Assert.NotEqual(first, second);
        Assert.True(MediaKeys.IsValid(first));
    }

    [Fact]
    public async Task DiskStorage_SavesAndOpensFile()
    {
        var storage = new DiskMediaStorage(_root);
        byte[] bytes = [.. PngHeader, 1, 2, 3];

        await storage.SaveAsync("products/2026/11/a.png", new MemoryStream(bytes), "image/png");
        var file = await storage.OpenAsync("products/2026/11/a.png");

        Assert.NotNull(file);
        await using var content = file.Content;
        using var copy = new MemoryStream();
        await content.CopyToAsync(copy);
        Assert.Equal(bytes, copy.ToArray());
        Assert.Equal("image/png", file.ContentType);
        Assert.Equal(bytes.Length, file.Length);
        Assert.Empty(Directory.GetFiles(_root, "*.part", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task DiskStorage_MissingFile_ReturnsNull()
    {
        Assert.Null(await new DiskMediaStorage(_root).OpenAsync("products/none.jpg"));
    }

    [Fact]
    public async Task DiskStorage_RejectsUnsafeKey()
    {
        var storage = new DiskMediaStorage(_root);

        await Assert.ThrowsAsync<ArgumentException>(() => storage.SaveAsync("../escape.jpg", new MemoryStream(JpegHeader), "image/jpeg"));
        await Assert.ThrowsAsync<ArgumentException>(() => storage.OpenAsync("../escape.jpg"));
    }

    [Fact]
    public async Task Uploader_SavesImageUnderMediaUrl()
    {
        var storage = new DiskMediaStorage(_root);
        var uploader = new ProductImageUploader(storage, new MediaOptions(), TimeProvider.System);
        byte[] bytes = [.. WebpHeader, 9, 9];

        var result = await uploader.UploadAsync(new MemoryStream(bytes), bytes.Length);

        Assert.Null(result.Error);
        Assert.StartsWith("/media/products/", result.Value!.Url);
        Assert.EndsWith(".webp", result.Value.Url);
        Assert.Equal("image/webp", result.Value.ContentType);
        var saved = await storage.OpenAsync(result.Value.Url["/media/".Length..]);
        Assert.NotNull(saved);
        await saved.Content.DisposeAsync();
    }

    [Fact]
    public async Task Uploader_RejectsNonImage()
    {
        var uploader = new ProductImageUploader(new DiskMediaStorage(_root), new MediaOptions(), TimeProvider.System);
        var bytes = "<svg onload=alert(1)>"u8.ToArray();

        var result = await uploader.UploadAsync(new MemoryStream(bytes), bytes.Length);

        Assert.NotNull(result.Error);
        Assert.True(result.Error.Errors!.ContainsKey("file"));
        Assert.False(Directory.Exists(_root));
    }

    [Fact]
    public async Task Uploader_RejectsTooLargeAndEmptyFiles()
    {
        var uploader = new ProductImageUploader(new DiskMediaStorage(_root), new MediaOptions { MaxImageBytes = 16 }, TimeProvider.System);
        byte[] bytes = [.. JpegHeader, .. new byte[10]];

        var tooLarge = await uploader.UploadAsync(new MemoryStream(bytes), bytes.Length);
        var empty = await uploader.UploadAsync(new MemoryStream(), 0);

        Assert.True(tooLarge.Error!.Errors!.ContainsKey("file"));
        Assert.True(empty.Error!.Errors!.ContainsKey("file"));
    }

    [Theory]
    [InlineData(null, typeof(DiskMediaStorage))]
    [InlineData("Disk", typeof(DiskMediaStorage))]
    [InlineData("S3", typeof(S3MediaStorage))]
    public void ConfiguredProvider_IsResolvedByApplicationServices(string? provider, Type storageType)
    {
        using var services = BuildServices(new()
        {
            ["Media:Provider"] = provider,
            ["Media:S3:ServiceUrl"] = "https://account.r2.cloudflarestorage.com",
            ["Media:S3:Bucket"] = "photos",
            ["Media:S3:AccessKeyId"] = "key",
            ["Media:S3:SecretAccessKey"] = "secret",
        });

        Assert.IsType(storageType, services.GetRequiredService<IMediaStorage>());
    }

    [Fact]
    public void DiskProvider_RelativePathIsUnderContentRoot()
    {
        using var services = BuildServices(new() { ["contentRoot"] = _root, ["Media:Disk:Path"] = "uploads" });

        var storage = Assert.IsType<DiskMediaStorage>(services.GetRequiredService<IMediaStorage>());

        Assert.Equal(Path.Combine(Path.GetFullPath(_root), "uploads"), storage.Root);
    }

    [Theory]
    [InlineData("S3", "Media:S3:Bucket")]
    [InlineData("Ftp", "Media:Provider")]
    public void InvalidConfiguration_FailsAtStartup(string provider, string expectedInMessage)
    {
        var error = Assert.Throws<InvalidOperationException>(() => BuildServices(new() { ["Media:Provider"] = provider }));

        Assert.Contains(expectedInMessage, error.Message);
    }

    private static ServiceProvider BuildServices(Dictionary<string, string?> settings)
    {
        settings["ConnectionStrings:Store"] = "Host=localhost;Database=not_used";
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddStoreInfrastructure(configuration);
        return services.BuildServiceProvider();
    }
}
