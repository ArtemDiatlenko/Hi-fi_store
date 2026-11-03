using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static HiFiStore.Tests.Integration.OrderTestHelpers;

namespace HiFiStore.Tests.Integration;

public sealed class CustomerOrdersApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [SkippableFact]
    public async Task LoggedInCheckout_LinksOrderToAccount()
    {
        await factory.PrepareAsync();
        var product = await CreateProductAsync(factory, stock: 5, price: 700m);
        var (token, _) = await RegisterCustomerAsync(_client);

        var first = await PlaceOrderAsync(_client, CheckoutBody((product.Id, 1)), token);
        var second = await PlaceOrderAsync(_client, CheckoutBody((product.Id, 2)), token);

        var list = await GetJsonAsync("/api/account/orders", token);
        Assert.Equal(2, list.GetProperty("totalCount").GetInt32());
        var items = list.GetProperty("items").EnumerateArray().ToList();
        // Новые сверху.
        Assert.Equal(Id(second), items[0].GetProperty("id").GetGuid());
        Assert.Equal(Id(first), items[1].GetProperty("id").GetGuid());
        Assert.Equal(2, items[0].GetProperty("itemCount").GetInt32());
        Assert.Equal(1400m, items[0].GetProperty("total").GetDecimal());

        var details = await GetJsonAsync($"/api/account/orders/{Id(first)}", token);
        Assert.Equal(first.GetProperty("order").GetProperty("number").GetInt64(), details.GetProperty("number").GetInt64());
        Assert.Equal(product.Name, details.GetProperty("items")[0].GetProperty("name").GetString());
    }

    [SkippableFact]
    public async Task AccountOrders_RequireAuthentication()
    {
        await factory.PrepareAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/account/orders")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync($"/api/account/orders/{Guid.NewGuid()}")).StatusCode);
    }

    [SkippableFact]
    public async Task AccountOrders_ShowOnlyOwnOrders()
    {
        await factory.PrepareAsync();
        var product = await CreateProductAsync(factory, stock: 10);
        var (alice, _) = await RegisterCustomerAsync(_client);
        var (bob, _) = await RegisterCustomerAsync(_client);

        var aliceOrder = await PlaceOrderAsync(_client, CheckoutBody((product.Id, 1)), alice);
        await PlaceOrderAsync(_client, CheckoutBody((product.Id, 1))); // гостевой

        var bobList = await GetJsonAsync("/api/account/orders", bob);
        Assert.Equal(0, bobList.GetProperty("totalCount").GetInt32());

        var bobView = await SendAsync(_client, HttpMethod.Get, $"/api/account/orders/{Id(aliceOrder)}", bob);
        Assert.Equal(HttpStatusCode.NotFound, bobView.StatusCode);

        var aliceList = await GetJsonAsync("/api/account/orders", alice);
        Assert.Equal(Id(aliceOrder), Assert.Single(aliceList.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
    }

    [SkippableFact]
    public async Task AccountOrders_Paging_IsValidated()
    {
        await factory.PrepareAsync();
        var (token, _) = await RegisterCustomerAsync(_client);

        var response = await SendAsync(_client, HttpMethod.Get, "/api/account/orders?page=0&pageSize=500", token);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("page", out _));
        Assert.True(errors.TryGetProperty("pageSize", out _));
    }

    private async Task<JsonElement> GetJsonAsync(string url, string token)
    {
        var response = await SendAsync(_client, HttpMethod.Get, url, token);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static Guid Id(JsonElement placed) => placed.GetProperty("order").GetProperty("id").GetGuid();
}
