using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace HiFiStore.Tests.Integration;

public sealed class AccountProfileApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    [SkippableFact]
    public async Task Customer_UpdatesNameAndPhone_AndSeesThemInMe()
    {
        await factory.PrepareAsync();
        using var customer = await factory.CreateCustomerClientAsync();

        var response = await customer.PutAsJsonAsync("/api/account/profile", new { fullName = "  Олена Коваль ", phone = "+48 512 345 678" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await customer.GetFromJsonAsync<JsonElement>("/api/account/me");
        Assert.Equal("Олена Коваль", me.GetProperty("fullName").GetString());
        Assert.Equal("+48512345678", me.GetProperty("phone").GetString());
    }

    [SkippableFact]
    public async Task EmptyValues_ClearProfile()
    {
        await factory.PrepareAsync();
        using var customer = await factory.CreateCustomerClientAsync();
        await customer.PutAsJsonAsync("/api/account/profile", new { fullName = "Олена", phone = "+380671234567" });

        var response = await customer.PutAsJsonAsync("/api/account/profile", new { fullName = " ", phone = "" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, me.GetProperty("fullName").ValueKind);
        Assert.Equal(JsonValueKind.Null, me.GetProperty("phone").ValueKind);
    }

    [SkippableTheory]
    [InlineData("0671234567")]
    [InlineData("+380 67 123")]
    public async Task InvalidPhone_IsRejected(string phone)
    {
        await factory.PrepareAsync();
        using var customer = await factory.CreateCustomerClientAsync();

        var response = await customer.PutAsJsonAsync("/api/account/profile", new { fullName = "Олена", phone });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("phone", out _));
    }

    [SkippableFact]
    public async Task Anonymous_CannotUpdateProfile()
    {
        await factory.PrepareAsync();
        using var anonymous = factory.CreateClient();

        var response = await anonymous.PutAsJsonAsync("/api/account/profile", new { fullName = "X" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
