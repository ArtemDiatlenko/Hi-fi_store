using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Integration.Admin;

public sealed class AdminProductsApiTests(StoreWebApplicationFactory factory) : AdminApiTestBase(factory)
{
    [SkippableFact]
    public async Task Product_CreateGetUpdateDelete()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);

        var created = await Admin.PostAsJsonAsync("/api/admin/products", ProductBody(branch, suffix));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var product = await ReadJsonAsync(created);
        var id = product.GetProperty("id").GetGuid();
        Assert.EndsWith($"/api/admin/products/{id}", created.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal($"testovyy-usilitel-{suffix}", product.GetProperty("slug").GetString());
        Assert.False(product.GetProperty("isPublished").GetBoolean());
        Assert.Equal(branch.CategoryId, product.GetProperty("category").GetProperty("id").GetGuid());
        Assert.Equal(["weight_kg", "color", "wifi"], product.GetProperty("availableSpecs").EnumerateArray().Select(s => s.GetProperty("key").GetString()));

        var fetched = await GetAsync($"/api/admin/products/{id}");
        Assert.Equal(1000m, fetched.GetProperty("price").GetDecimal());

        var updated = await PutAsync($"/api/admin/products/{id}", ProductBody(branch, suffix) with
        {
            Name = $"Обновлённый усилитель {suffix}",
            Price = 900m,
            OldPrice = 1200m,
            Stock = 0,
            Condition = "Demo",
        });
        Assert.Equal($"Обновлённый усилитель {suffix}", updated.GetProperty("name").GetString());
        Assert.Equal($"testovyy-usilitel-{suffix}", updated.GetProperty("slug").GetString());
        Assert.Equal(1200m, updated.GetProperty("oldPrice").GetDecimal());
        Assert.Equal("Demo", updated.GetProperty("condition").GetString());

        await DeleteAsync($"/api/admin/products/{id}");
        await GetAsync($"/api/admin/products/{id}", HttpStatusCode.NotFound);
    }

    [SkippableFact]
    public async Task Product_WithOrders_CanBeDeleted_OrderKeepsSnapshot()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var id = (await PostAsync("/api/admin/products", ProductBody(branch, suffix))).GetProperty("id").GetGuid();
        await PostAsync($"/api/admin/products/{id}/publish", null, HttpStatusCode.OK);

        var placed = await OrderTestHelpers.PlaceOrderAsync(Anonymous, OrderTestHelpers.CheckoutBody((id, 2)));
        var orderId = placed.GetProperty("order").GetProperty("id").GetGuid();

        // Позиции заказа — снимок без внешнего ключа на товар, поэтому заказанный товар удаляется.
        await DeleteAsync($"/api/admin/products/{id}");
        await GetAsync($"/api/admin/products/{id}", HttpStatusCode.NotFound);

        var order = await GetAsync($"/api/admin/orders/{orderId}");
        var item = Assert.Single(order.GetProperty("items").EnumerateArray());
        Assert.Equal(id, item.GetProperty("productId").GetGuid());
        Assert.Equal($"TST-{suffix}", item.GetProperty("sku").GetString());
        Assert.Equal($"Тестовый усилитель {suffix}", item.GetProperty("name").GetString());
        Assert.Equal(1000m, item.GetProperty("unitPrice").GetDecimal());
        Assert.Equal(2000m, order.GetProperty("total").GetDecimal());

        // Отмена такого заказа проходит: остаток вернуть некуда, и это не ошибка.
        var cancelled = await PutAsync($"/api/admin/orders/{orderId}/status", new { status = "Cancelled" });
        Assert.Equal("Cancelled", cancelled.GetProperty("status").GetString());
    }

    [SkippableFact]
    public async Task Product_StaysHiddenFromCatalogUntilPublished()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var product = await PostAsync("/api/admin/products", ProductBody(branch, suffix));
        var id = product.GetProperty("id").GetGuid();
        var slug = product.GetProperty("slug").GetString();
        var catalogSearch = $"/api/catalog/products?q={suffix}";

        Assert.Equal(HttpStatusCode.NotFound, (await Anonymous.GetAsync($"/api/catalog/products/{slug}")).StatusCode);
        Assert.Equal(0, (await Anonymous.GetFromJsonAsync<JsonElement>(catalogSearch)).GetProperty("totalCount").GetInt32());

        var published = await PostAsync($"/api/admin/products/{id}/publish", null, HttpStatusCode.OK);
        Assert.True(published.GetProperty("isPublished").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await Anonymous.GetAsync($"/api/catalog/products/{slug}")).StatusCode);
        Assert.Equal(1, (await Anonymous.GetFromJsonAsync<JsonElement>(catalogSearch)).GetProperty("totalCount").GetInt32());

        var unpublished = await PostAsync($"/api/admin/products/{id}/unpublish", null, HttpStatusCode.OK);
        Assert.False(unpublished.GetProperty("isPublished").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await Anonymous.GetAsync($"/api/catalog/products/{slug}")).StatusCode);
    }

    [SkippableFact]
    public async Task ProductList_IncludesUnpublishedAndFilters()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var draft = await PostAsync("/api/admin/products", ProductBody(branch, suffix));
        var live = await PostAsync("/api/admin/products", ProductBody(branch, suffix) with
        {
            Sku = $"LIVE-{suffix}",
            Name = $"Опубликованный {suffix}",
        });
        await PostAsync($"/api/admin/products/{live.GetProperty("id").GetGuid()}/publish", null, HttpStatusCode.OK);

        // Раздел-родитель включает товары подразделов; поиск работает и по артикулу.
        var all = await GetAsync($"/api/admin/products?categoryId={branch.ParentCategoryId}");
        Assert.Equal(2, all.GetProperty("totalCount").GetInt32());

        var drafts = await GetAsync($"/api/admin/products?brandId={branch.BrandId}&published=false");
        var onlyDraft = Assert.Single(drafts.GetProperty("items").EnumerateArray());
        Assert.Equal(draft.GetProperty("id").GetGuid(), onlyDraft.GetProperty("id").GetGuid());
        Assert.False(onlyDraft.GetProperty("isPublished").GetBoolean());

        var bySku = await GetAsync($"/api/admin/products?q=live-{suffix}");
        Assert.Equal(live.GetProperty("id").GetGuid(), Assert.Single(bySku.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());

        var demoDraft = await GetAsync("/api/admin/products?q=vg-se300");
        Assert.Equal("Vega SE-300 (чернетка)", Assert.Single(demoDraft.GetProperty("items").EnumerateArray()).GetProperty("name").GetString());

        var invalid = await GetAsync("/api/admin/products?pageSize=0&categoryId=abc&published=maybe", HttpStatusCode.BadRequest);
        AssertFieldErrors(invalid, "pageSize", "categoryId", "published");
    }

    [SkippableFact]
    public async Task Product_InvalidData_ReturnsValidationProblem()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);

        var problem = await PostAsync("/api/admin/products", ProductBody(branch, suffix) with
        {
            Name = " ",
            Slug = "Плохой slug",
            Price = -1m,
            OldPrice = -5m,
            Stock = -1,
        }, HttpStatusCode.BadRequest);
        AssertFieldErrors(problem, "name", "slug", "price", "oldPrice", "stock");
        Assert.Equal("Цена не может быть отрицательной.", problem.GetProperty("errors").GetProperty("price")[0].GetString());

        var oldPrice = await PostAsync("/api/admin/products", ProductBody(branch, suffix) with { OldPrice = 1000m }, HttpStatusCode.BadRequest);
        AssertFieldErrors(oldPrice, "oldPrice");

        var references = await PostAsync("/api/admin/products", ProductBody(branch, suffix) with
        {
            CategoryId = Guid.NewGuid(),
            BrandId = null,
        }, HttpStatusCode.BadRequest);
        AssertFieldErrors(references, "categoryId", "brandId");

        var missing = await PostAsync("/api/admin/products", new { }, HttpStatusCode.BadRequest);
        AssertFieldErrors(missing, "sku", "name", "price", "categoryId", "brandId");
    }

    [SkippableFact]
    public async Task Product_MalformedBody_ReturnsValidationProblemInRussian()
    {
        await PrepareAsync();

        var wrongType = await Admin.PostAsync("/api/admin/products",
            new StringContent("""{"name": "Усилитель", "price": "дорого"}""", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, wrongType.StatusCode);
        var problem = await ReadJsonAsync(wrongType);
        AssertFieldErrors(problem, "price");
        Assert.False(problem.GetProperty("errors").TryGetProperty("request", out _));
        Assert.StartsWith("Некорректное значение", problem.GetProperty("errors").GetProperty("price")[0].GetString());

        var empty = await Admin.PostAsync("/api/admin/products", new StringContent("", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        AssertFieldErrors(await ReadJsonAsync(empty), "body");
    }

    [SkippableFact]
    public async Task Product_DuplicateSkuOrSlug_ReturnsConflict()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);

        var sku = await PostAsync("/api/admin/products", ProductBody(branch, suffix) with { Sku = "AU-I80" }, HttpStatusCode.Conflict);
        Assert.Contains("AU-I80", sku.GetProperty("detail").GetString());

        var slug = await PostAsync("/api/admin/products", ProductBody(branch, suffix) with { Slug = "aurora-i-80" }, HttpStatusCode.Conflict);
        Assert.Contains("aurora-i-80", slug.GetProperty("detail").GetString());
    }

    [SkippableFact]
    public async Task ProductSpecs_ValidatedByTypeAndCategory()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var id = (await PostAsync("/api/admin/products", ProductBody(branch, suffix))).GetProperty("id").GetGuid();

        // weight_kg объявлена у родительского раздела, color и wifi — у раздела товара.
        var withSpecs = await PutAsync($"/api/admin/products/{id}/specs", new
        {
            specs = new Dictionary<string, object?> { ["weight_kg"] = 12.5m, ["color"] = " Серебристый ", ["wifi"] = true },
        });
        var specs = SpecValues(withSpecs);
        Assert.Equal(12.5m, specs["weight_kg"].GetDecimal());
        Assert.Equal("Серебристый", specs["color"].GetString());
        Assert.True(specs["wifi"].GetBoolean());

        // Набор заменяется целиком; числа можно передавать строкой.
        var replaced = await PutAsync($"/api/admin/products/{id}/specs", new
        {
            specs = new Dictionary<string, object?> { ["weight_kg"] = "7", ["wifi"] = null },
        });
        Assert.Equal(["weight_kg"], SpecValues(replaced).Keys);
        Assert.Equal(7m, SpecValues(replaced)["weight_kg"].GetDecimal());

        var invalid = await PutAsync($"/api/admin/products/{id}/specs", new
        {
            specs = new Dictionary<string, object?> { ["weight_kg"] = "тяжёлый", ["wifi"] = "да", ["color"] = 5, ["power_w"] = 100 },
        }, HttpStatusCode.BadRequest);
        AssertFieldErrors(invalid, "specs.weight_kg", "specs.wifi", "specs.color", "specs.power_w");

        // Неудачный запрос ничего не меняет.
        Assert.Equal(["weight_kg"], SpecValues(await GetAsync($"/api/admin/products/{id}")).Keys);
    }

    [SkippableFact]
    public async Task ProductSpecs_DroppedWhenCategoryChanges_AndBlockSpecTypeChange()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var id = (await PostAsync("/api/admin/products", ProductBody(branch, suffix))).GetProperty("id").GetGuid();
        await PutAsync($"/api/admin/products/{id}/specs", new
        {
            specs = new Dictionary<string, object?> { ["weight_kg"] = 3, ["color"] = "Чёрный" },
        });

        var category = await GetAsync($"/api/admin/categories/{branch.CategoryId}");
        var color = category.GetProperty("specs").EnumerateArray().Single(s => s.GetProperty("key").GetString() == "color");
        var typeChange = await PutAsync(
            $"/api/admin/categories/{branch.CategoryId}/specs/{color.GetProperty("id").GetGuid()}",
            new { key = "color", name = "Цвет", valueType = "Number" },
            HttpStatusCode.Conflict);
        Assert.Contains("тип", typeChange.GetProperty("detail").GetString());

        // В родительском разделе остаётся только weight_kg: color относится к прежнему подразделу.
        var moved = await PutAsync($"/api/admin/products/{id}", ProductBody(branch, suffix) with { CategoryId = branch.ParentCategoryId });
        Assert.Equal(["weight_kg"], SpecValues(moved).Keys);
    }

    [SkippableFact]
    public async Task ProductImages_ReplacedInOrderAndShownInCatalog()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var product = await PostAsync("/api/admin/products", ProductBody(branch, suffix));
        var id = product.GetProperty("id").GetGuid();

        var withImages = await PutAsync($"/api/admin/products/{id}/images", new
        {
            images = new object[]
            {
                new { url = "https://example.com/front.png", alt = "Вид спереди" },
                new { url = "/images/back.png", alt = (string?)null },
            },
        });
        Assert.Equal(
            ["https://example.com/front.png", "/images/back.png"],
            withImages.GetProperty("images").EnumerateArray().Select(i => i.GetProperty("url").GetString()));

        var reordered = await PutAsync($"/api/admin/products/{id}/images", new
        {
            images = new object[] { new { url = "/images/back.png" }, new { url = "https://example.com/front.png", alt = "Вид спереди" } },
        });
        Assert.Equal("/images/back.png", reordered.GetProperty("images")[0].GetProperty("url").GetString());

        var invalid = await PutAsync($"/api/admin/products/{id}/images", new
        {
            images = new object[] { new { url = "https://example.com/ok.png" }, new { url = "javascript:alert(1)" }, new { url = "" } },
        }, HttpStatusCode.BadRequest);
        AssertFieldErrors(invalid, "images[1].url", "images[2].url");

        await PostAsync($"/api/admin/products/{id}/publish", null, HttpStatusCode.OK);
        var card = await Anonymous.GetFromJsonAsync<JsonElement>($"/api/catalog/products/{product.GetProperty("slug").GetString()}");
        Assert.Equal(
            ["/images/back.png", "https://example.com/front.png"],
            card.GetProperty("images").EnumerateArray().Select(i => i.GetProperty("url").GetString()));

        var cleared = await PutAsync($"/api/admin/products/{id}/images", new { images = Array.Empty<object>() });
        Assert.Empty(cleared.GetProperty("images").EnumerateArray());
    }

    [SkippableFact]
    public async Task Product_TimestampsComeFromTimeProvider()
    {
        await PrepareAsync();
        var clock = new ManualTimeProvider(DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds()));
        using var timedFactory = Factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(clock)));
        using var admin = await timedFactory.CreateAdminClientAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var createdAt = clock.GetUtcNow();

        var created = await admin.PostAsJsonAsync("/api/admin/products", ProductBody(branch, suffix));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var product = await ReadJsonAsync(created);
        var id = product.GetProperty("id").GetGuid();
        Assert.Equal(createdAt, product.GetProperty("createdAt").GetDateTimeOffset());
        Assert.Equal(createdAt, product.GetProperty("updatedAt").GetDateTimeOffset());

        clock.Advance(TimeSpan.FromMinutes(5));
        var publish = await admin.PostAsync($"/api/admin/products/{id}/publish", null);
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);
        var published = await ReadJsonAsync(publish);
        Assert.Equal(createdAt, published.GetProperty("createdAt").GetDateTimeOffset());
        Assert.Equal(createdAt.AddMinutes(5), published.GetProperty("updatedAt").GetDateTimeOffset());

        // Повторная публикация ничего не меняет и не трогает UpdatedAt.
        clock.Advance(TimeSpan.FromMinutes(5));
        var again = await ReadJsonAsync(await admin.PostAsync($"/api/admin/products/{id}/publish", null));
        Assert.Equal(createdAt.AddMinutes(5), again.GetProperty("updatedAt").GetDateTimeOffset());
    }

    [SkippableFact]
    public async Task Product_Unknown_ReturnsNotFound()
    {
        await PrepareAsync();
        var missing = Guid.NewGuid();

        await GetAsync($"/api/admin/products/{missing}", HttpStatusCode.NotFound);
        await DeleteAsync($"/api/admin/products/{missing}", HttpStatusCode.NotFound);
        await PostAsync($"/api/admin/products/{missing}/publish", null, HttpStatusCode.NotFound);
        await PutAsync($"/api/admin/products/{missing}/specs", new { specs = new { } }, HttpStatusCode.NotFound);
        await PutAsync($"/api/admin/products/{missing}/images", new { images = Array.Empty<object>() }, HttpStatusCode.NotFound);
    }

    private static ProductBodyModel ProductBody(TestBranch branch, string suffix) => new()
    {
        Sku = $"TST-{suffix}",
        Name = $"Тестовый усилитель {suffix}",
        ShortDescription = "Короткое описание",
        Description = "Полное описание",
        Price = 1000m,
        Stock = 3,
        CategoryId = branch.CategoryId,
        BrandId = branch.BrandId,
    };

    private static Dictionary<string, JsonElement> SpecValues(JsonElement product) =>
        product.GetProperty("specs").EnumerateArray()
            .ToDictionary(s => s.GetProperty("key").GetString()!, s => s.GetProperty("value"));

    /// <summary>Тело запроса товара; <c>with</c> позволяет менять отдельные поля в тестах.</summary>
    private sealed record ProductBodyModel
    {
        public string? Sku { get; init; }

        public string? Name { get; init; }

        public string? Slug { get; init; }

        public string? ShortDescription { get; init; }

        public string? Description { get; init; }

        public decimal? Price { get; init; }

        public decimal? OldPrice { get; init; }

        public int? Stock { get; init; }

        public string? Condition { get; init; }

        public Guid? CategoryId { get; init; }

        public Guid? BrandId { get; init; }
    }

    private sealed class ManualTimeProvider(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan delta) => _now += delta;
    }
}
