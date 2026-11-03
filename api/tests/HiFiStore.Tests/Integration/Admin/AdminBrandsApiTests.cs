using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace HiFiStore.Tests.Integration.Admin;

public sealed class AdminBrandsApiTests(StoreWebApplicationFactory factory) : AdminApiTestBase(factory)
{
    [SkippableFact]
    public async Task Brand_CreateGetUpdateDelete()
    {
        await PrepareAsync();
        var suffix = NewSuffix();

        var created = await Admin.PostAsJsonAsync("/api/admin/brands", new { name = $"Тестовый бренд {suffix}", country = "Россия" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var brand = await ReadJsonAsync(created);
        var id = brand.GetProperty("id").GetGuid();
        Assert.EndsWith($"/api/admin/brands/{id}", created.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal($"testovyy-brend-{suffix}", brand.GetProperty("slug").GetString());
        Assert.Equal(0, brand.GetProperty("productCount").GetInt32());

        var list = await GetAsync("/api/admin/brands");
        Assert.Contains(list.EnumerateArray(), b => b.GetProperty("id").GetGuid() == id);

        // Без slug в запросе slug не меняется, даже если изменилось название.
        var updated = await PutAsync($"/api/admin/brands/{id}", new { name = $"Переименованный {suffix}", country = (string?)null });
        Assert.Equal($"Переименованный {suffix}", updated.GetProperty("name").GetString());
        Assert.Equal($"testovyy-brend-{suffix}", updated.GetProperty("slug").GetString());
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("country").ValueKind);

        var reslugged = await PutAsync($"/api/admin/brands/{id}", new { name = "Бренд", slug = $"brand-{suffix}" });
        Assert.Equal($"brand-{suffix}", reslugged.GetProperty("slug").GetString());

        await DeleteAsync($"/api/admin/brands/{id}");
        await GetAsync($"/api/admin/brands/{id}", HttpStatusCode.NotFound);
    }

    [SkippableFact]
    public async Task Brand_DuplicateSlug_ReturnsConflict()
    {
        await PrepareAsync();

        var problem = await PostAsync("/api/admin/brands", new { name = "Ще одна Aurora", slug = "aurora" }, HttpStatusCode.Conflict);

        Assert.Contains("aurora", problem.GetProperty("detail").GetString());
    }

    [SkippableFact]
    public async Task Brand_WithProducts_CannotBeDeleted()
    {
        await PrepareAsync();
        var brands = await GetAsync("/api/admin/brands");
        var auroraId = brands.EnumerateArray().Single(b => b.GetProperty("slug").GetString() == "aurora").GetProperty("id").GetGuid();

        var problem = await DeleteAsync($"/api/admin/brands/{auroraId}", HttpStatusCode.Conflict);

        Assert.Contains("есть товары", problem.GetProperty("detail").GetString());
        await GetAsync($"/api/admin/brands/{auroraId}");
    }

    [SkippableFact]
    public async Task Brand_InvalidData_ReturnsValidationProblem()
    {
        await PrepareAsync();

        var problem = await PostAsync(
            "/api/admin/brands", new { name = "  ", slug = "Bad Slug", country = new string('x', 101) }, HttpStatusCode.BadRequest);

        AssertFieldErrors(problem, "name", "slug", "country");
        Assert.Equal("Укажите название бренда.", problem.GetProperty("errors").GetProperty("name")[0].GetString());
    }

    [SkippableFact]
    public async Task Brand_Unknown_ReturnsNotFound()
    {
        await PrepareAsync();

        await GetAsync($"/api/admin/brands/{Guid.NewGuid()}", HttpStatusCode.NotFound);
        await PutAsync($"/api/admin/brands/{Guid.NewGuid()}", new { name = "Нет такого" }, HttpStatusCode.NotFound);
        await DeleteAsync($"/api/admin/brands/{Guid.NewGuid()}", HttpStatusCode.NotFound);
    }
}
