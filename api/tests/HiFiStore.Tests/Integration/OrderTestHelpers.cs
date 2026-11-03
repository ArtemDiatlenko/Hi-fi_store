using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Tests.Integration;

public sealed record TestProduct(Guid Id, string Name, decimal Price);

/// <summary>
/// Данные для тестов заказов. Каждый тест создаёт свои товары в собственном разделе,
/// чтобы списание остатков не влияло на тесты каталога, которые идут параллельно.
/// </summary>
internal static class OrderTestHelpers
{
    public static async Task<TestProduct> CreateProductAsync(
        StoreWebApplicationFactory factory, int stock, decimal price = 1000m, bool published = true)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();

        var suffix = Guid.NewGuid().ToString("N")[..12];
        var now = DateTimeOffset.UtcNow;
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = $"T-{suffix}",
            Name = $"Тестовый товар {suffix}",
            Slug = $"orders-test-{suffix}",
            Price = price,
            Stock = stock,
            IsPublished = published,
            Category = new Category { Id = Guid.NewGuid(), Name = $"Тест заказов {suffix}", Slug = $"orders-test-{suffix}" },
            Brand = new Brand { Id = Guid.NewGuid(), Name = $"Тест {suffix}", Slug = $"orders-test-{suffix}" },
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.Products.Add(product);
        await db.SaveChangesAsync();
        return new TestProduct(product.Id, product.Name, product.Price);
    }

    public static async Task<int> GetStockAsync(StoreWebApplicationFactory factory, Guid productId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        return await db.Products.AsNoTracking().Where(p => p.Id == productId).Select(p => p.Stock).SingleAsync();
    }

    /// <summary>Корректный запрос оформления: доставка в отделение Новой почты, оплата при получении.</summary>
    public static Dictionary<string, object?> CheckoutBody(params (Guid ProductId, int Quantity)[] items) => new()
    {
        ["items"] = items.Select(i => new { productId = i.ProductId, quantity = i.Quantity }).ToArray(),
        ["fullName"] = "Иван Петров",
        ["phone"] = "+380 67 123 45 67",
        ["email"] = "ivan@example.com",
        ["deliveryMethod"] = "NovaPoshtaWarehouse",
        ["city"] = "Киев",
        ["warehouse"] = "Отделение №12",
        ["paymentMethod"] = "CashOnDelivery",
        ["comment"] = "Позвоните перед отправкой",
    };

    public static async Task<HttpResponseMessage> PostOrderAsync(
        HttpClient client, object body, string? token = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/orders") { Content = JsonContent.Create(body) };
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return await client.SendAsync(request);
    }

    /// <summary>Оформляет заказ и возвращает ответ (токен и заказ). Падает, если заказ не создан.</summary>
    public static async Task<JsonElement> PlaceOrderAsync(
        HttpClient client, object body, string? token = null)
    {
        var response = await PostOrderAsync(client, body, token);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(response.StatusCode == System.Net.HttpStatusCode.Created, $"Ожидался 201, пришёл {(int)response.StatusCode}: {json}");
        return json;
    }

    /// <summary>Регистрирует покупателя (роль <c>Customer</c>) и возвращает его bearer-токен и email.</summary>
    public static async Task<(string Token, string Email)> RegisterCustomerAsync(HttpClient client)
    {
        var email = await client.RegisterNewUserAsync("buyer");
        return (await client.LoginAsync(email, HttpClientAuthExtensions.CustomerPassword), email);
    }

    public static Task<string> LoginAdminAsync(HttpClient client) =>
        client.LoginAsync(StoreWebApplicationFactory.AdminEmail, StoreWebApplicationFactory.AdminPassword);

    public static async Task<HttpResponseMessage> SendAsync(
        HttpClient client, HttpMethod method, string url, string? token, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return await client.SendAsync(request);
    }
}
