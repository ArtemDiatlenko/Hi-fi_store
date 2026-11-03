using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static HiFiStore.Tests.Integration.OrderTestHelpers;

namespace HiFiStore.Tests.Integration;

public sealed class AdminOrdersApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [SkippableFact]
    public async Task AdminEndpoints_RequireAdminRole()
    {
        await factory.PrepareAsync();
        var (customer, _) = await RegisterCustomerAsync(_client);
        var id = Guid.NewGuid();

        foreach (var (method, url, body) in new (HttpMethod, string, object?)[]
                 {
                     (HttpMethod.Get, "/api/admin/orders", null),
                     (HttpMethod.Get, $"/api/admin/orders/{id}", null),
                     (HttpMethod.Put, $"/api/admin/orders/{id}/status", new { status = "Confirmed" }),
                 })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync(_client, method, url, token: null, body)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(_client, method, url, customer, body)).StatusCode);
        }
    }

    [SkippableFact]
    public async Task List_FiltersByStatus_AndSearchesByNumberPhoneEmail()
    {
        await factory.PrepareAsync();
        var admin = await LoginAdminAsync(_client);
        var product = await CreateProductAsync(factory, stock: 10);
        var unique = Random.Shared.Next(1000000, 9999999).ToString();

        var body = CheckoutBody((product.Id, 1));
        body["email"] = $"Search.{unique}@Example.com";
        body["phone"] = $"+380 (50) {unique}";
        var placed = await PlaceOrderAsync(_client, body);
        var id = placed.GetProperty("order").GetProperty("id").GetGuid();
        var number = placed.GetProperty("order").GetProperty("number").GetInt64();

        Assert.Contains(id, await ListIdsAsync(admin, $"q=search.{unique}@example"));
        Assert.Contains(id, await ListIdsAsync(admin, $"q={Uri.EscapeDataString($"50 {unique[..3]}-{unique[3..]}")}"));
        Assert.Contains(id, await ListIdsAsync(admin, $"q={Uri.EscapeDataString($"№{number}")}"));
        Assert.DoesNotContain(id, await ListIdsAsync(admin, $"q=nobody-{unique}@example.com"));

        Assert.Contains(id, await ListIdsAsync(admin, "status=new&pageSize=100&q=" + unique));
        Assert.DoesNotContain(id, await ListIdsAsync(admin, "status=Cancelled&q=" + unique));

        var summary = (await GetJsonAsync(admin, $"/api/admin/orders?q={unique}")).GetProperty("items")[0];
        Assert.True(summary.GetProperty("isGuest").GetBoolean());
        Assert.Equal($"+38050{unique}", summary.GetProperty("customerPhone").GetString());

        var details = await GetJsonAsync(admin, $"/api/admin/orders/{id}");
        Assert.Equal(["Confirmed", "Cancelled"], details.GetProperty("nextStatuses").EnumerateArray().Select(s => s.GetString()));
        Assert.Equal(JsonValueKind.Null, details.GetProperty("userId").ValueKind);
    }

    [SkippableFact]
    public async Task List_InvalidFilter_ReturnsValidationProblem()
    {
        await factory.PrepareAsync();
        var admin = await LoginAdminAsync(_client);

        var response = await SendAsync(_client, HttpMethod.Get, "/api/admin/orders?status=Lost&pageSize=1000", admin);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("status", out _));
        Assert.True(errors.TryGetProperty("pageSize", out _));
    }

    [SkippableFact]
    public async Task StatusChanges_FollowTheWorkflow()
    {
        await factory.PrepareAsync();
        var admin = await LoginAdminAsync(_client);
        var product = await CreateProductAsync(factory, stock: 5);
        var id = await PlaceOrderIdAsync(product.Id, 1);

        await ExpectConflictAsync(admin, id, "Completed");

        var confirmed = await ChangeStatusAsync(admin, id, "Confirmed");
        Assert.Equal("Confirmed", confirmed.GetProperty("status").GetString());
        Assert.Equal(["Shipped", "Cancelled"], confirmed.GetProperty("nextStatuses").EnumerateArray().Select(s => s.GetString()));

        await ChangeStatusAsync(admin, id, "Shipped");
        var completed = await ChangeStatusAsync(admin, id, "Completed");
        Assert.Empty(completed.GetProperty("nextStatuses").EnumerateArray());

        var conflict = await ExpectConflictAsync(admin, id, "Cancelled");
        Assert.Contains("«Выполнен»", conflict.GetProperty("detail").GetString());

        // Выполненный заказ не трогает склад.
        Assert.Equal(4, await GetStockAsync(factory, product.Id));

        var unknownStatus = await SendAsync(_client, HttpMethod.Put, $"/api/admin/orders/{id}/status", admin, new { status = "Lost" });
        Assert.Equal(HttpStatusCode.BadRequest, unknownStatus.StatusCode);

        // Ошибка разбора тела — в общем формате админки: по имени поля, а не «$.status».
        var wrongType = await SendAsync(_client, HttpMethod.Put, $"/api/admin/orders/{id}/status", admin, new { status = 5 });
        Assert.Equal(HttpStatusCode.BadRequest, wrongType.StatusCode);
        var wrongTypeErrors = (await wrongType.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal(["status"], wrongTypeErrors.EnumerateObject().Select(e => e.Name));

        var unknownOrder = await SendAsync(_client, HttpMethod.Put, $"/api/admin/orders/{Guid.NewGuid()}/status", admin, new { status = "Confirmed" });
        Assert.Equal(HttpStatusCode.NotFound, unknownOrder.StatusCode);
    }

    [SkippableFact]
    public async Task Cancel_ReturnsItemsToStock_ExactlyOnce()
    {
        await factory.PrepareAsync();
        var admin = await LoginAdminAsync(_client);
        var product = await CreateProductAsync(factory, stock: 5);
        var other = await CreateProductAsync(factory, stock: 3);

        var id = await PlaceOrderIdAsync(product.Id, 2, (other.Id, 3));
        Assert.Equal(3, await GetStockAsync(factory, product.Id));
        Assert.Equal(0, await GetStockAsync(factory, other.Id));

        await ChangeStatusAsync(admin, id, "Confirmed");
        var cancelled = await ChangeStatusAsync(admin, id, "Cancelled");
        Assert.Equal("Cancelled", cancelled.GetProperty("status").GetString());
        Assert.Equal(5, await GetStockAsync(factory, product.Id));
        Assert.Equal(3, await GetStockAsync(factory, other.Id));

        await ExpectConflictAsync(admin, id, "Cancelled");
        Assert.Equal(5, await GetStockAsync(factory, product.Id));
    }

    [SkippableFact]
    public async Task ParallelCancels_ReturnStockOnce()
    {
        await factory.PrepareAsync();
        var admin = await LoginAdminAsync(_client);
        var product = await CreateProductAsync(factory, stock: 4);
        var id = await PlaceOrderIdAsync(product.Id, 3);
        Assert.Equal(1, await GetStockAsync(factory, product.Id));

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ =>
            SendAsync(_client, HttpMethod.Put, $"/api/admin/orders/{id}/status", admin, new { status = "Cancelled" })));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Equal(5, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(4, await GetStockAsync(factory, product.Id));
    }

    private async Task<Guid> PlaceOrderIdAsync(Guid productId, int quantity, params (Guid, int)[] more)
    {
        var placed = await PlaceOrderAsync(_client, CheckoutBody([(productId, quantity), .. more]));
        return placed.GetProperty("order").GetProperty("id").GetGuid();
    }

    private async Task<JsonElement> ChangeStatusAsync(string admin, Guid id, string status)
    {
        var response = await SendAsync(_client, HttpMethod.Put, $"/api/admin/orders/{id}/status", admin, new { status });
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Смена статуса на {status}: {(int)response.StatusCode} {json}");
        return json;
    }

    private async Task<JsonElement> ExpectConflictAsync(string admin, Guid id, string status)
    {
        var response = await SendAsync(_client, HttpMethod.Put, $"/api/admin/orders/{id}/status", admin, new { status });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private async Task<List<Guid>> ListIdsAsync(string admin, string query) =>
        (await GetJsonAsync(admin, $"/api/admin/orders?{query}"))
            .GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetGuid()).ToList();

    private async Task<JsonElement> GetJsonAsync(string token, string url)
    {
        var response = await SendAsync(_client, HttpMethod.Get, url, token);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
