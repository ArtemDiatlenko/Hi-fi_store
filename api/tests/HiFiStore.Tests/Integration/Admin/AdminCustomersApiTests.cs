using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static HiFiStore.Tests.Integration.OrderTestHelpers;

namespace HiFiStore.Tests.Integration.Admin;

public sealed class AdminCustomersApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [SkippableFact]
    public async Task Customers_RequireAdminRole()
    {
        await factory.PrepareAsync();
        var (token, _) = await RegisterCustomerAsync(_client);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/admin/customers")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(_client, HttpMethod.Get, "/api/admin/customers", token)).StatusCode);
    }

    [SkippableFact]
    public async Task List_FindsRegisteredCustomer_WithOrderStatsAndRegistrationDate()
    {
        await factory.PrepareAsync();
        var product = await CreateProductAsync(factory, stock: 5, price: 1500m);
        var (token, email) = await RegisterCustomerAsync(_client);
        var body = CheckoutBody((product.Id, 2));
        body["email"] = email;
        await PlaceOrderAsync(_client, body, token);
        var admin = await LoginAdminAsync(_client);

        var list = await GetJsonAsync($"/api/admin/customers?q={Uri.EscapeDataString(email)}", admin);

        Assert.Equal(1, list.GetProperty("totalCount").GetInt32());
        var customer = list.GetProperty("items")[0];
        Assert.Equal(email, customer.GetProperty("email").GetString());
        Assert.False(customer.GetProperty("isAdmin").GetBoolean());
        Assert.Equal(1, customer.GetProperty("orderCount").GetInt32());
        Assert.Equal(3000m, customer.GetProperty("ordersTotal").GetDecimal());
        Assert.NotEqual(JsonValueKind.Null, customer.GetProperty("registeredAt").ValueKind);

        var id = customer.GetProperty("id").GetGuid();
        var details = await GetJsonAsync($"/api/admin/customers/{id}", admin);
        Assert.Equal(["Customer"], details.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));

        var orders = await GetJsonAsync($"/api/admin/orders?customerId={id}", admin);
        Assert.Equal(1, orders.GetProperty("totalCount").GetInt32());
    }

    [SkippableFact]
    public async Task Unlock_ClearsLockout()
    {
        await factory.PrepareAsync();
        var (_, email) = await RegisterCustomerAsync(_client);
        Guid id;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
            var user = await db.Users.SingleAsync(u => u.Email == email);
            user.LockoutEnd = DateTimeOffset.UtcNow.AddHours(1);
            user.AccessFailedCount = 5;
            await db.SaveChangesAsync();
            id = user.Id;
        }

        var admin = await LoginAdminAsync(_client);
        Assert.True((await GetJsonAsync($"/api/admin/customers/{id}", admin)).GetProperty("isLockedOut").GetBoolean());

        var response = await SendAsync(_client, HttpMethod.Post, $"/api/admin/customers/{id}/unlock", admin);
        response.EnsureSuccessStatusCode();
        var unlocked = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.False(unlocked.GetProperty("isLockedOut").GetBoolean());
        Assert.Equal(0, unlocked.GetProperty("accessFailedCount").GetInt32());
    }

    [SkippableFact]
    public async Task UnknownCustomer_Returns404()
    {
        await factory.PrepareAsync();
        var admin = await LoginAdminAsync(_client);

        Assert.Equal(HttpStatusCode.NotFound,
            (await SendAsync(_client, HttpMethod.Get, $"/api/admin/customers/{Guid.NewGuid()}", admin)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await SendAsync(_client, HttpMethod.Post, $"/api/admin/customers/{Guid.NewGuid()}/unlock", admin)).StatusCode);
    }

    private async Task<JsonElement> GetJsonAsync(string url, string token)
    {
        var response = await SendAsync(_client, HttpMethod.Get, url, token);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(response.IsSuccessStatusCode, $"{url}: {(int)response.StatusCode} {json}");
        return json;
    }
}
