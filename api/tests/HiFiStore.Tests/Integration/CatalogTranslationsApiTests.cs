using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HiFiStore.Tests.Integration.Admin;

namespace HiFiStore.Tests.Integration;

public sealed class CatalogTranslationsApiTests(StoreWebApplicationFactory factory) : AdminApiTestBase(factory)
{
    [SkippableFact]
    public async Task Catalog_InEnglish_ShowsDemoTranslations_AndUkrainianByDefault()
    {
        await PrepareAsync();

        var en = await Anonymous.GetFromJsonAsync<JsonElement>("/api/catalog/products/nord-audio-ns-5-walnut?lang=en");
        var uk = await Anonymous.GetFromJsonAsync<JsonElement>("/api/catalog/products/nord-audio-ns-5-walnut");

        Assert.Equal("Bookshelf speakers in a solid walnut cabinet, 8 Ω.", en.GetProperty("shortDescription").GetString());
        Assert.Equal("Bookshelf speakers", en.GetProperty("category").GetProperty("name").GetString());
        var material = en.GetProperty("specs").EnumerateArray().Single(s => s.GetProperty("key").GetString() == "material");
        Assert.Equal("Cabinet material", material.GetProperty("name").GetString());
        Assert.Equal("Wood", material.GetProperty("value").GetString());
        Assert.Equal("Поличні колонки в корпусі з натурального горіха, 8 Ом.", uk.GetProperty("shortDescription").GetString());

        var tree = await Anonymous.GetFromJsonAsync<JsonElement>("/api/catalog/categories?lang=en");
        Assert.Contains(tree.EnumerateArray(), c => c.GetProperty("name").GetString() == "Speakers");

        // Неизвестный язык — основной текст.
        var unknown = await Anonymous.GetFromJsonAsync<JsonElement>("/api/catalog/products/nord-audio-ns-5-walnut?lang=xx");
        Assert.Equal(uk.GetProperty("shortDescription").GetString(), unknown.GetProperty("shortDescription").GetString());
    }

    [SkippableFact]
    public async Task Facets_InEnglish_KeepBaseValues_AndAddLabels()
    {
        await PrepareAsync();

        var facets = await Anonymous.GetFromJsonAsync<JsonElement>("/api/catalog/facets?category=bookshelf-speakers&lang=en");
        var material = facets.GetProperty("specs").EnumerateArray().Single(s => s.GetProperty("key").GetString() == "material");

        Assert.Equal("Cabinet material", material.GetProperty("name").GetString());
        Assert.Contains("Дерево", material.GetProperty("values").EnumerateArray().Select(v => v.GetString()));
        Assert.Equal("Wood", material.GetProperty("valueLabels").GetProperty("Дерево").GetString());

        // Фильтр по-прежнему работает по основному значению.
        var filtered = await Anonymous.GetFromJsonAsync<JsonElement>(
            $"/api/catalog/products?category=bookshelf-speakers&spec.material={Uri.EscapeDataString("Дерево")}&lang=en");
        Assert.Contains(filtered.GetProperty("items").EnumerateArray(), p => p.GetProperty("name").GetString() == "Nord Audio NS-5 Walnut");
    }

    [SkippableFact]
    public async Task AdminTranslation_RoundTrip_FallbackAndSearch()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var product = await PostAsync("/api/admin/products", new
        {
            name = $"Підсилювач {suffix}",
            sku = $"TR-{suffix}",
            price = 1000,
            stock = 1,
            condition = "New",
            brandId = branch.BrandId,
            categoryId = branch.CategoryId,
            shortDescription = "Короткий опис",
            description = "Повний опис",
        });
        var id = product.GetProperty("id").GetGuid();
        var slug = product.GetProperty("slug").GetString();
        await PutAsync($"/api/admin/products/{id}/specs", new { specs = new { color = "Чорний" } });
        await PostAsync($"/api/admin/products/{id}/publish", null, HttpStatusCode.OK);

        // Без перевода английская витрина показывает основной текст.
        var fallback = await Anonymous.GetFromJsonAsync<JsonElement>($"/api/catalog/products/{slug}?lang=en");
        Assert.Equal($"Підсилювач {suffix}", fallback.GetProperty("name").GetString());

        var empty = await GetAsync($"/api/admin/products/{id}/translations/en");
        Assert.Equal($"Підсилювач {suffix}", empty.GetProperty("baseName").GetString());
        Assert.Equal(JsonValueKind.Null, empty.GetProperty("name").ValueKind);
        Assert.Equal("Чорний", empty.GetProperty("specs")[0].GetProperty("baseValue").GetString());

        var saved = await PutAsync($"/api/admin/products/{id}/translations/en", new
        {
            name = $" Amplifier {suffix} ",
            shortDescription = "Short",
            description = "",
            specs = new Dictionary<string, string?> { ["color"] = "Black" },
        });
        Assert.Equal($"Amplifier {suffix}", saved.GetProperty("name").GetString());

        var en = await Anonymous.GetFromJsonAsync<JsonElement>($"/api/catalog/products/{slug}?lang=en");
        Assert.Equal($"Amplifier {suffix}", en.GetProperty("name").GetString());
        Assert.Equal("Short", en.GetProperty("shortDescription").GetString());
        // Пустое описание перевода — основное описание.
        Assert.Equal("Повний опис", en.GetProperty("description").GetString());
        Assert.Equal("Black", en.GetProperty("specs").EnumerateArray().Single(s => s.GetProperty("key").GetString() == "color").GetProperty("value").GetString());

        var search = await Anonymous.GetFromJsonAsync<JsonElement>($"/api/catalog/products?q=amplifier%20{suffix}&lang=en");
        Assert.Equal(1, search.GetProperty("totalCount").GetInt32());

        // Новое основное значение — старый перевод больше не подходит.
        await PutAsync($"/api/admin/products/{id}/specs", new { specs = new { color = "Білий" } });
        var afterChange = await GetAsync($"/api/admin/products/{id}/translations/en");
        Assert.Equal(JsonValueKind.Null, afterChange.GetProperty("specs")[0].GetProperty("value").ValueKind);

        // Пустое название удаляет перевод.
        await PutAsync($"/api/admin/products/{id}/translations/en", new { name = "" });
        var removed = await Anonymous.GetFromJsonAsync<JsonElement>($"/api/catalog/products/{slug}?lang=en");
        Assert.Equal($"Підсилювач {suffix}", removed.GetProperty("name").GetString());
    }

    [SkippableFact]
    public async Task AdminTranslation_Validates()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var product = await PostAsync("/api/admin/products", new
        {
            name = $"Товар {suffix}", sku = $"TV-{suffix}", price = 10, stock = 1, condition = "New",
            brandId = branch.BrandId, categoryId = branch.CategoryId,
        });
        var id = product.GetProperty("id").GetGuid();

        var problem = await PutAsync($"/api/admin/products/{id}/translations/en",
            new { name = "", description = "Text", specs = new Dictionary<string, string?> { ["nope"] = "x" } },
            HttpStatusCode.BadRequest);
        AssertFieldErrors(problem, "name", "specs.nope");

        await PutAsync($"/api/admin/products/{id}/translations/de", new { name = "X" }, HttpStatusCode.NotFound);
        await GetAsync($"/api/admin/products/{Guid.NewGuid()}/translations/en", HttpStatusCode.NotFound);
    }

    [SkippableFact]
    public async Task CategoryTranslation_RenamesCategoryAndSpecs()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);

        var saved = await PutAsync($"/api/admin/categories/{branch.ParentCategoryId}/translations/en", new
        {
            name = $"Test section {suffix}",
            specs = new Dictionary<string, object?> { ["weight_kg"] = new { name = "Weight", unit = "kg" } },
        });

        Assert.Equal($"Test section {suffix}", saved.GetProperty("name").GetString());
        var spec = saved.GetProperty("specs").EnumerateArray().Single();
        Assert.Equal("Weight", spec.GetProperty("name").GetString());
        Assert.Equal("kg", spec.GetProperty("unit").GetString());

        var tree = await Anonymous.GetFromJsonAsync<JsonElement>("/api/catalog/categories?lang=en");
        Assert.Contains(tree.EnumerateArray(), c => c.GetProperty("name").GetString() == $"Test section {suffix}");

        var invalid = await PutAsync($"/api/admin/categories/{branch.ParentCategoryId}/translations/en",
            new { name = "X", specs = new Dictionary<string, object?> { ["weight_kg"] = new { unit = "kg" } } },
            HttpStatusCode.BadRequest);
        AssertFieldErrors(invalid, "specs.weight_kg.name");
    }
}
