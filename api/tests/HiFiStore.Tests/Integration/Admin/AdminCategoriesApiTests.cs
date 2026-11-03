using System.Net;
using System.Text.Json;

namespace HiFiStore.Tests.Integration.Admin;

public sealed class AdminCategoriesApiTests(StoreWebApplicationFactory factory) : AdminApiTestBase(factory)
{
    [SkippableFact]
    public async Task Category_CreateListUpdateDelete()
    {
        await PrepareAsync();
        var suffix = NewSuffix();

        var root = await PostAsync("/api/admin/categories", new { name = $"Усилители мощности {suffix}", description = "Описание" });
        var rootId = root.GetProperty("id").GetGuid();
        Assert.Equal($"usiliteli-moshchnosti-{suffix}", root.GetProperty("slug").GetString());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("parentId").ValueKind);

        var child = await PostAsync("/api/admin/categories", new { name = "Моноблоки", slug = $"monoblocks-{suffix}", parentId = rootId, sortOrder = 5 });
        var childId = child.GetProperty("id").GetGuid();

        // Плоский список: подраздел идёт сразу после родителя и знает его id.
        var list = (await GetAsync("/api/admin/categories")).EnumerateArray().ToList();
        var rootIndex = list.FindIndex(c => c.GetProperty("id").GetGuid() == rootId);
        Assert.Equal(childId, list[rootIndex + 1].GetProperty("id").GetGuid());
        Assert.Equal(rootId, list[rootIndex + 1].GetProperty("parentId").GetGuid());
        Assert.Equal(1, list[rootIndex].GetProperty("childCount").GetInt32());

        var updated = await PutAsync($"/api/admin/categories/{childId}", new { name = "Моноблочные усилители", parentId = rootId, sortOrder = 1 });
        Assert.Equal("Моноблочные усилители", updated.GetProperty("name").GetString());
        Assert.Equal($"monoblocks-{suffix}", updated.GetProperty("slug").GetString());
        Assert.Equal(1, updated.GetProperty("sortOrder").GetInt32());

        // Перенос в корень.
        var moved = await PutAsync($"/api/admin/categories/{childId}", new { name = "Моноблочные усилители", parentId = (Guid?)null });
        Assert.Equal(JsonValueKind.Null, moved.GetProperty("parentId").ValueKind);

        await DeleteAsync($"/api/admin/categories/{childId}");
        await DeleteAsync($"/api/admin/categories/{rootId}");
        await GetAsync($"/api/admin/categories/{rootId}", HttpStatusCode.NotFound);
    }

    [SkippableFact]
    public async Task Category_MoveUnderAnotherParent_PreventsCycles()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var a = await CreateCategoryAsync($"A {suffix}");
        var b = await CreateCategoryAsync($"B {suffix}", a);
        var c = await CreateCategoryAsync($"C {suffix}");

        var moved = await PutAsync($"/api/admin/categories/{c}", new { name = $"C {suffix}", parentId = b });
        Assert.Equal(b, moved.GetProperty("parentId").GetGuid());

        // A → C (внук A): цикл.
        var cycle = await PutAsync($"/api/admin/categories/{a}", new { name = $"A {suffix}", parentId = c }, HttpStatusCode.BadRequest);
        AssertFieldErrors(cycle, "parentId");

        var self = await PutAsync($"/api/admin/categories/{a}", new { name = $"A {suffix}", parentId = a }, HttpStatusCode.BadRequest);
        AssertFieldErrors(self, "parentId");

        var missing = await PutAsync($"/api/admin/categories/{a}", new { name = $"A {suffix}", parentId = Guid.NewGuid() }, HttpStatusCode.BadRequest);
        AssertFieldErrors(missing, "parentId");
    }

    [SkippableFact]
    public async Task Category_WithChildrenOrProducts_CannotBeDeleted()
    {
        await PrepareAsync();
        var categories = (await GetAsync("/api/admin/categories")).EnumerateArray().ToList();
        Guid IdOf(string slug) => categories.Single(c => c.GetProperty("slug").GetString() == slug).GetProperty("id").GetGuid();

        var withChildren = await DeleteAsync($"/api/admin/categories/{IdOf("amplifiers")}", HttpStatusCode.Conflict);
        Assert.Contains("подразделы", withChildren.GetProperty("detail").GetString());

        var withProducts = await DeleteAsync($"/api/admin/categories/{IdOf("integrated-amplifiers")}", HttpStatusCode.Conflict);
        Assert.Contains("товары", withProducts.GetProperty("detail").GetString());
    }

    [SkippableFact]
    public async Task Category_DuplicateSlug_ReturnsConflict()
    {
        await PrepareAsync();

        await PostAsync("/api/admin/categories", new { name = "Ещё акустика", slug = "speakers" }, HttpStatusCode.Conflict);
    }

    [SkippableFact]
    public async Task Category_InvalidData_ReturnsValidationProblem()
    {
        await PrepareAsync();

        var problem = await PostAsync("/api/admin/categories", new { name = "", slug = "-bad-" }, HttpStatusCode.BadRequest);

        AssertFieldErrors(problem, "name", "slug");
    }

    [SkippableFact]
    public async Task SpecDefinitions_AddUpdateDelete()
    {
        await PrepareAsync();
        var categoryId = await CreateCategoryAsync($"Фонокорректоры {NewSuffix()}");

        var spec = await PostAsync(
            $"/api/admin/categories/{categoryId}/specs",
            new { key = "gain_db", name = "Усиление", unit = "дБ", valueType = "Number", isFilterable = true, sortOrder = 2 });
        var specId = spec.GetProperty("id").GetGuid();
        Assert.Equal("Number", spec.GetProperty("valueType").GetString());

        var updated = await PutAsync(
            $"/api/admin/categories/{categoryId}/specs/{specId}",
            new { key = "gain", name = "Коэффициент усиления", unit = "дБ", valueType = "Number", isFilterable = false });
        Assert.Equal("gain", updated.GetProperty("key").GetString());
        Assert.False(updated.GetProperty("isFilterable").GetBoolean());

        var category = await GetAsync($"/api/admin/categories/{categoryId}");
        var only = Assert.Single(category.GetProperty("specs").EnumerateArray());
        Assert.Equal("Коэффициент усиления", only.GetProperty("name").GetString());

        await DeleteAsync($"/api/admin/categories/{categoryId}/specs/{specId}");
        await GetAsync($"/api/admin/categories/{categoryId}/specs/{specId}", HttpStatusCode.NotFound);
        Assert.Empty((await GetAsync($"/api/admin/categories/{categoryId}")).GetProperty("specs").EnumerateArray());
    }

    [SkippableFact]
    public async Task SpecDefinitions_KeyMustBeUniqueWithinBranch()
    {
        await PrepareAsync();
        var suffix = NewSuffix();
        var parent = await CreateCategoryAsync($"Родитель {suffix}");
        var child = await CreateCategoryAsync($"Потомок {suffix}", parent);
        var other = await CreateCategoryAsync($"Другой {suffix}");
        await AddSpecAsync(parent, "weight_kg", "Number");

        var inChild = await PostAsync(
            $"/api/admin/categories/{child}/specs", new { key = "weight_kg", name = "Вес", valueType = "Number" }, HttpStatusCode.Conflict);
        Assert.Contains("weight_kg", inChild.GetProperty("detail").GetString());

        // В другой ветке тот же ключ допустим.
        await AddSpecAsync(other, "weight_kg", "Number");

        // А перенос раздела с таким ключом в ветку, где он уже есть, — нет.
        await PutAsync($"/api/admin/categories/{other}", new { name = $"Другой {suffix}", parentId = child }, HttpStatusCode.Conflict);
    }

    [SkippableFact]
    public async Task SpecDefinitions_InvalidData_ReturnsValidationProblem()
    {
        await PrepareAsync();
        var categoryId = await CreateCategoryAsync($"Кабели питания {NewSuffix()}");

        var problem = await PostAsync(
            $"/api/admin/categories/{categoryId}/specs", new { key = "Power W", name = "", valueType = (string?)null }, HttpStatusCode.BadRequest);

        AssertFieldErrors(problem, "key", "name", "valueType");
        await PostAsync(
            $"/api/admin/categories/{Guid.NewGuid()}/specs", new { key = "x", name = "X", valueType = "Text" }, HttpStatusCode.NotFound);
    }
}
