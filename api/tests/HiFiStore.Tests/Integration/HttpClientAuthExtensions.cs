using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HiFiStore.Tests.Integration;

/// <summary>Вход и регистрация через стандартные эндпоинты Identity для интеграционных тестов.</summary>
public static class HttpClientAuthExtensions
{
    public const string CustomerPassword = "Customer-test-2026";

    /// <summary>Входит под указанной учётной записью и возвращает bearer-токен.</summary>
    public static async Task<string> LoginAsync(this HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("accessToken").GetString()!;
    }

    /// <summary>Регистрирует нового пользователя с уникальным email и возвращает этот email.</summary>
    public static async Task<string> RegisterNewUserAsync(this HttpClient client, string prefix = "customer")
    {
        var email = $"{prefix}-{Guid.NewGuid():N}@test.local";
        var response = await client.PostAsJsonAsync("/api/auth/register", new { email, password = CustomerPassword });
        response.EnsureSuccessStatusCode();
        return email;
    }

    /// <summary>Клиент с bearer-токеном администратора из <see cref="StoreWebApplicationFactory"/>.</summary>
    public static async Task<HttpClient> CreateAdminClientAsync<TEntryPoint>(this WebApplicationFactory<TEntryPoint> factory)
        where TEntryPoint : class
    {
        var client = factory.CreateClient();
        var token = await client.LoginAsync(StoreWebApplicationFactory.AdminEmail, StoreWebApplicationFactory.AdminPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>Клиент с bearer-токеном только что зарегистрированного покупателя.</summary>
    public static async Task<HttpClient> CreateCustomerClientAsync<TEntryPoint>(this WebApplicationFactory<TEntryPoint> factory)
        where TEntryPoint : class
    {
        var client = factory.CreateClient();
        var email = await client.RegisterNewUserAsync();
        var token = await client.LoginAsync(email, CustomerPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
