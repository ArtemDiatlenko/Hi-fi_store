using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace HiFiStore.Tests.Integration;

public sealed class RegistrationApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [SkippableFact]
    public async Task Register_AssignsCustomerRole()
    {
        await factory.PrepareAsync();

        var email = await _client.RegisterNewUserAsync();
        var token = await _client.LoginAsync(email, HttpClientAuthExtensions.CustomerPassword);

        var me = await GetMeAsync(token);
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.Equal(["Customer"], me.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [SkippableFact]
    public async Task Register_InvalidPassword_ReturnsValidationProblemAndCreatesNoUser()
    {
        await factory.PrepareAsync();
        var email = $"weak-{Guid.NewGuid():N}@test.local";

        var response = await _client.PostAsJsonAsync("/api/auth/register", new { email, password = "short" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var login = await _client.PostAsJsonAsync("/api/auth/login", new { email, password = "short" });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [SkippableFact]
    public async Task Register_DuplicateEmail_KeepsSingleCustomerRole()
    {
        await factory.PrepareAsync();
        var email = await _client.RegisterNewUserAsync();

        var duplicate = await _client.PostAsJsonAsync(
            "/api/auth/register", new { email, password = HttpClientAuthExtensions.CustomerPassword });

        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        var token = await _client.LoginAsync(email, HttpClientAuthExtensions.CustomerPassword);
        var me = await GetMeAsync(token);
        Assert.Equal(["Customer"], me.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    private async Task<JsonElement> GetMeAsync(string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/account/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
