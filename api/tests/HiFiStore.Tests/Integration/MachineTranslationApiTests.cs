using System.Net;
using System.Text.Json;
using HiFiStore.Tests.Integration.Admin;

namespace HiFiStore.Tests.Integration;

public sealed class MachineTranslationApiTests(StoreWebApplicationFactory factory) : AdminApiTestBase(factory), IDisposable
{
    public void Dispose()
    {
        Factory.Translator.IsEnabled = false;
        Factory.Translator.Fail = false;
    }

    private async Task<Guid> CreateProductAsync(TestBranch branch, string suffix, string? shortDescription = "Короткий опис")
    {
        var product = await PostAsync("/api/admin/products", new
        {
            name = $"Підсилювач {suffix}",
            sku = $"MT-{suffix}",
            price = 1000,
            stock = 1,
            condition = "New",
            brandId = branch.BrandId,
            categoryId = branch.CategoryId,
            shortDescription,
            description = "Повний опис",
        });
        return product.GetProperty("id").GetGuid();
    }

    [SkippableFact]
    public async Task ProductDraft_TranslatesBaseText_WithoutSaving()
    {
        await PrepareAsync();
        Factory.Translator.IsEnabled = true;
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var id = await CreateProductAsync(branch, suffix, shortDescription: null);
        await PutAsync($"/api/admin/products/{id}/specs", new { specs = new { color = "Чорний" } });

        var current = await GetAsync($"/api/admin/products/{id}/translations/en");
        Assert.True(current.GetProperty("machineTranslation").GetBoolean());

        var draft = await PostAsync($"/api/admin/products/{id}/translations/en/draft", null, HttpStatusCode.OK);
        Assert.Equal($"EN:Підсилювач {suffix}", draft.GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, draft.GetProperty("shortDescription").ValueKind);
        Assert.Equal("EN:Повний опис", draft.GetProperty("description").GetString());
        Assert.Equal("EN:Чорний", draft.GetProperty("specs").GetProperty("color").GetString());
        // Пустые поля переводчику не отправляются.
        Assert.DoesNotContain("shortDescription", Factory.Translator.LastTexts!.Keys);

        // Черновик не сохраняется: перевода по-прежнему нет.
        var after = await GetAsync($"/api/admin/products/{id}/translations/en");
        Assert.Equal(JsonValueKind.Null, after.GetProperty("name").ValueKind);
    }

    [SkippableFact]
    public async Task CategoryDraft_TranslatesNameAndSpecs()
    {
        await PrepareAsync();
        Factory.Translator.IsEnabled = true;
        var suffix = NewSuffix();
        var categoryId = await CreateCategoryAsync($"Розділ {suffix}");
        await AddSpecAsync(categoryId, "power", "Number", "Вт");

        var draft = await PostAsync($"/api/admin/categories/{categoryId}/translations/en/draft", null, HttpStatusCode.OK);
        Assert.Equal($"EN:Розділ {suffix}", draft.GetProperty("name").GetString());
        var power = draft.GetProperty("specs").GetProperty("power");
        Assert.StartsWith("EN:", power.GetProperty("name").GetString());
        Assert.Equal("EN:Вт", power.GetProperty("unit").GetString());
    }

    [SkippableFact]
    public async Task Draft_Returns503_WhenDisabledOrFailing()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var branch = await CreateBranchAsync(suffix);
        var id = await CreateProductAsync(branch, suffix);

        var current = await GetAsync($"/api/admin/products/{id}/translations/en");
        Assert.False(current.GetProperty("machineTranslation").GetBoolean());
        await PostAsync($"/api/admin/products/{id}/translations/en/draft", null, HttpStatusCode.ServiceUnavailable);

        Factory.Translator.IsEnabled = true;
        Factory.Translator.Fail = true;
        var problem = await PostAsync($"/api/admin/products/{id}/translations/en/draft", null, HttpStatusCode.ServiceUnavailable);
        Assert.Contains("недоступен", problem.GetProperty("detail").GetString());

        await PostAsync($"/api/admin/products/{Guid.NewGuid()}/translations/en/draft", null, HttpStatusCode.NotFound);
        await PostAsync($"/api/admin/products/{id}/translations/xx/draft", null, HttpStatusCode.NotFound);
    }

    [SkippableFact]
    public async Task Draft_RequiresAdmin()
    {
        await PrepareAsync();
        var response = await Anonymous.PostAsync($"/api/admin/products/{Guid.NewGuid()}/translations/en/draft", null);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
