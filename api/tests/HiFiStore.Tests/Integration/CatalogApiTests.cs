using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace HiFiStore.Tests.Integration;

public sealed class CatalogApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [SkippableFact]
    public async Task Categories_ReturnTreeWithChildren()
    {
        Prepare();

        var tree = await GetJsonAsync("/api/catalog/categories");

        var amplifiers = tree.EnumerateArray().Single(c => c.GetProperty("slug").GetString() == "amplifiers");
        Assert.Equal(2, amplifiers.GetProperty("children").GetArrayLength());
    }

    [SkippableFact]
    public async Task Products_CategoryIncludesDescendantsAndHidesUnpublished()
    {
        Prepare();

        var page = await GetJsonAsync("/api/catalog/products?category=amplifiers&pageSize=100");

        // 3 интегральных + 2 ламповых опубликованных; черновик «Вега SE-300» скрыт.
        Assert.Equal(5, page.GetProperty("totalCount").GetInt32());
        Assert.DoesNotContain(Names(page), n => n.Contains("черновик"));
    }

    [SkippableFact]
    public async Task Products_NumericSpecRange_FiltersInclusively()
    {
        Prepare();

        var page = await GetJsonAsync("/api/catalog/products?category=amplifiers&spec.power_w.min=50&spec.power_w.max=150&sort=name");

        Assert.Equal(["Аурора I-150 Pro", "Аурора I-80"], Names(page));
    }

    [SkippableFact]
    public async Task Products_TextSpecValuesCombineWithOr()
    {
        Prepare();

        var page = await GetJsonAsync("/api/catalog/products?category=tube-amplifiers&spec.tube_type=EL34,6V6&sort=name");

        Assert.Equal(["Кварц Лампа 25", "Кварц Лампа 8 Demo"], Names(page));
    }

    [SkippableFact]
    public async Task Products_BooleanSpecWithStockFilter()
    {
        Prepare();

        var page = await GetJsonAsync("/api/catalog/products?spec.bluetooth=true&inStock=true&sort=name");

        Assert.Equal(["Аурора I-80", "Норд Аудио NA-40"], Names(page));
    }

    [SkippableFact]
    public async Task Products_SortByPriceDescending()
    {
        Prepare();

        var page = await GetJsonAsync("/api/catalog/products?category=turntables&sort=price_desc");

        var prices = page.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("price").GetDecimal()).ToList();
        Assert.Equal(prices.OrderByDescending(p => p), prices);
    }

    [SkippableFact]
    public async Task Products_Pagination_ReturnsRequestedPage()
    {
        Prepare();

        var page = await GetJsonAsync("/api/catalog/products?sort=name&page=2&pageSize=5");

        Assert.Equal(2, page.GetProperty("page").GetInt32());
        Assert.Equal(5, page.GetProperty("items").GetArrayLength());
        Assert.True(page.GetProperty("totalPages").GetInt32() >= 3);
    }

    [SkippableFact]
    public async Task Products_InvalidParameters_ReturnValidationProblem()
    {
        Prepare();

        var response = await _client.GetAsync("/api/catalog/products?pageSize=500&sort=random");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        var errors = problem.GetProperty("errors");
        Assert.True(errors.TryGetProperty("pageSize", out _));
        Assert.True(errors.TryGetProperty("sort", out _));
    }

    [SkippableFact]
    public async Task Products_UnknownCategory_ReturnsNotFound()
    {
        Prepare();

        var response = await _client.GetAsync("/api/catalog/products?category=does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task Product_Published_ReturnsSpecsAndImages()
    {
        Prepare();

        var product = await GetJsonAsync("/api/catalog/products/aurora-i-80");

        Assert.Equal("Аурора I-80", product.GetProperty("name").GetString());
        Assert.Equal("Интегральные усилители", product.GetProperty("category").GetProperty("name").GetString());
        Assert.NotEmpty(product.GetProperty("images").EnumerateArray());
        Assert.Contains(product.GetProperty("specs").EnumerateArray(),
            s => s.GetProperty("key").GetString() == "power_w" && s.GetProperty("value").GetDecimal() == 80m);
    }

    [SkippableFact]
    public async Task Product_Unpublished_ReturnsNotFound()
    {
        Prepare();

        var response = await _client.GetAsync("/api/catalog/products/vega-se-300-draft");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task Facets_ExposeNumericRangeAndTextValues()
    {
        Prepare();

        var facets = await GetJsonAsync("/api/catalog/facets?category=amplifiers");

        var power = facets.GetProperty("specs").EnumerateArray().Single(s => s.GetProperty("key").GetString() == "power_w");
        Assert.Equal(8m, power.GetProperty("min").GetDecimal());
        Assert.Equal(150m, power.GetProperty("max").GetDecimal());

        var tube = facets.GetProperty("specs").EnumerateArray().Single(s => s.GetProperty("key").GetString() == "tube_type");
        Assert.Equal(["6V6", "EL34"], tube.GetProperty("values").EnumerateArray().Select(v => v.GetString()));
    }

    [SkippableFact]
    public async Task Account_Me_RequiresAuthentication()
    {
        Prepare();
        await factory.EnsureDatabaseAsync();

        var response = await _client.GetAsync("/api/account/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [SkippableFact]
    public async Task Account_Me_ReturnsRolesForAdmin()
    {
        Prepare();
        await factory.EnsureDatabaseAsync();

        var login = await _client.PostAsJsonAsync("/api/auth/login",
            new { email = StoreWebApplicationFactory.AdminEmail, password = StoreWebApplicationFactory.AdminPassword });
        login.EnsureSuccessStatusCode();
        var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString();

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/account/me");
        request.Headers.Authorization = new("Bearer", token);
        var response = await _client.SendAsync(request);

        response.EnsureSuccessStatusCode();
        var me = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(StoreWebApplicationFactory.AdminEmail, me.GetProperty("email").GetString());
        Assert.Contains("Admin", me.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    private static void Prepare() =>
        Skip.IfNot(StoreWebApplicationFactory.IsConfigured, "Задайте HIFISTORE_TEST_CONNECTION, чтобы запускать интеграционные тесты.");

    private async Task<JsonElement> GetJsonAsync(string url)
    {
        await factory.EnsureDatabaseAsync();
        var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static List<string> Names(JsonElement page) =>
        page.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("name").GetString()!).ToList();
}
