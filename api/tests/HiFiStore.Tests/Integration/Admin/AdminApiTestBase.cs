using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace HiFiStore.Tests.Integration.Admin;

/// <summary>
/// Общие помощники для тестов административного API. Тесты создают собственные бренды, разделы и товары
/// с уникальным суффиксом и не меняют демо-каталог, на который опираются тесты витрины.
/// </summary>
public abstract class AdminApiTestBase(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    protected StoreWebApplicationFactory Factory { get; } = factory;

    protected HttpClient Anonymous { get; } = factory.CreateClient();

    /// <summary>Клиент администратора; доступен после <see cref="PrepareAsync"/>.</summary>
    protected HttpClient Admin { get; private set; } = null!;

    protected async Task PrepareAsync()
    {
        await Factory.PrepareAsync();
        Admin = await Factory.CreateAdminClientAsync();
    }

    protected static string NewSuffix() => Guid.NewGuid().ToString("N")[..8];

    protected static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    /// <summary>Отправляет запрос от администратора, проверяет статус и возвращает тело ответа.</summary>
    protected async Task<JsonElement> SendAsync(HttpMethod method, string url, object? body, HttpStatusCode expected)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        var response = await Admin.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();
        Assert.True(expected == response.StatusCode, $"{method} {url}: ожидался {expected}, получен {response.StatusCode}. {content}");
        return content.Length == 0 ? default : JsonDocument.Parse(content).RootElement.Clone();
    }

    protected Task<JsonElement> GetAsync(string url, HttpStatusCode expected = HttpStatusCode.OK) =>
        SendAsync(HttpMethod.Get, url, null, expected);

    protected Task<JsonElement> PostAsync(string url, object? body, HttpStatusCode expected = HttpStatusCode.Created) =>
        SendAsync(HttpMethod.Post, url, body, expected);

    protected Task<JsonElement> PutAsync(string url, object body, HttpStatusCode expected = HttpStatusCode.OK) =>
        SendAsync(HttpMethod.Put, url, body, expected);

    protected Task<JsonElement> DeleteAsync(string url, HttpStatusCode expected = HttpStatusCode.NoContent) =>
        SendAsync(HttpMethod.Delete, url, null, expected);

    protected static void AssertFieldErrors(JsonElement problem, params string[] fields)
    {
        var errors = problem.GetProperty("errors");
        foreach (var field in fields)
        {
            Assert.True(errors.TryGetProperty(field, out var messages), $"Нет ошибки для поля {field}: {errors}");
            Assert.NotEmpty(messages.EnumerateArray());
        }
    }

    protected async Task<Guid> CreateBrandAsync(string suffix)
    {
        var brand = await PostAsync("/api/admin/brands", new { name = $"Бренд {suffix}" });
        return brand.GetProperty("id").GetGuid();
    }

    protected async Task<Guid> CreateCategoryAsync(string name, Guid? parentId = null)
    {
        var category = await PostAsync("/api/admin/categories", new { name, parentId });
        return category.GetProperty("id").GetGuid();
    }

    protected async Task<Guid> AddSpecAsync(Guid categoryId, string key, string valueType, string? unit = null)
    {
        var spec = await PostAsync(
            $"/api/admin/categories/{categoryId}/specs",
            new { key, name = $"Характеристика {key}", unit, valueType, isFilterable = true });
        return spec.GetProperty("id").GetGuid();
    }

    /// <summary>
    /// Ветка каталога для тестов товаров: раздел с числовой характеристикой <c>weight_kg</c>
    /// и подраздел с <c>color</c> (текст) и <c>wifi</c> (да/нет), плюс бренд.
    /// </summary>
    protected async Task<TestBranch> CreateBranchAsync(string suffix)
    {
        var parentId = await CreateCategoryAsync($"Тестовый раздел {suffix}");
        await AddSpecAsync(parentId, "weight_kg", "Number", "кг");
        var childId = await CreateCategoryAsync($"Тестовый подраздел {suffix}", parentId);
        await AddSpecAsync(childId, "color", "Text");
        await AddSpecAsync(childId, "wifi", "Boolean");
        var brandId = await CreateBrandAsync(suffix);
        return new TestBranch(parentId, childId, brandId);
    }

    protected sealed record TestBranch(Guid ParentCategoryId, Guid CategoryId, Guid BrandId);
}
