using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static HiFiStore.Tests.Integration.OrderTestHelpers;

namespace HiFiStore.Tests.Integration;

/// <summary>
/// Заявки на консультацию. У каждого теста свой X-Forwarded-For: ограничение частоты считается по адресу,
/// и тесты, идущие параллельно, не должны расходовать общий лимит.
/// </summary>
public sealed class InquiriesApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static Dictionary<string, object?> Body(string name, string email) => new()
    {
        ["topic"] = "CustomBuild",
        ["name"] = name,
        ["phone"] = "+380 67 123 45 67",
        ["email"] = email,
        ["preferredContact"] = "Telegram",
        ["message"] = "Хочу ламповий підсилювач на EL34 для колонок 90 дБ, кімната 20 м².",
        ["budget"] = "до 80 000 ₴",
        ["productSlug"] = "aurora-i-80",
        ["consent"] = true,
    };

    private Task<HttpResponseMessage> PostAsync(object body, string clientIp)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/inquiries") { Content = JsonContent.Create(body) };
        request.Headers.Add("X-Forwarded-For", clientIp);
        return _client.SendAsync(request);
    }

    private static string UniqueIp() => $"10.{Random.Shared.Next(256)}.{Random.Shared.Next(256)}.{Random.Shared.Next(1, 255)}";

    [SkippableFact]
    public async Task Create_SavesInquiry_EmailsOwnerAndCustomer_AndShowsInAdmin()
    {
        await factory.PrepareAsync();
        var name = $"Тарас {Guid.NewGuid():N}";
        var email = $"inquiry-{Guid.NewGuid():N}@test.local";

        var response = await PostAsync(Body(name, email), UniqueIp());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var number = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("number").GetInt64();
        Assert.True(number >= 1001);

        await factory.Emails.WaitForAsync(StoreWebApplicationFactory.OwnerEmail, $"Нова заявка №{number}");
        await factory.Emails.WaitForAsync(email, $"Заявку №{number} отримано");

        var admin = await LoginAdminAsync(_client);
        var list = await GetJsonAsync($"/api/admin/inquiries?q={Uri.EscapeDataString(name)}", admin);
        Assert.Equal(1, list.GetProperty("totalCount").GetInt32());
        var id = list.GetProperty("items")[0].GetProperty("id").GetGuid();

        var details = await GetJsonAsync($"/api/admin/inquiries/{id}", admin);
        Assert.Equal("New", details.GetProperty("status").GetString());
        Assert.Equal("+380671234567", details.GetProperty("phone").GetString());
        Assert.Equal("Aurora I-80", details.GetProperty("productName").GetString());

        var updated = await SendAsync(_client, HttpMethod.Put, $"/api/admin/inquiries/{id}", admin,
            new { status = "InProgress", adminNote = "Перезвонить в пятницу" });
        updated.EnsureSuccessStatusCode();
        var updatedJson = await updated.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("InProgress", updatedJson.GetProperty("status").GetString());
        Assert.Equal("Перезвонить в пятницу", updatedJson.GetProperty("adminNote").GetString());
    }

    [SkippableFact]
    public async Task Create_InvalidContact_ReturnsFieldErrors()
    {
        await factory.PrepareAsync();
        var body = Body("Ірина", "");
        body["phone"] = "";
        body["consent"] = false;
        body["message"] = "коротко";

        var response = await PostAsync(body, UniqueIp());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("phone", out _), "Для Telegram нужен телефон.");
        Assert.True(errors.TryGetProperty("consent", out _));
        Assert.True(errors.TryGetProperty("message", out _));
    }

    [SkippableFact]
    public async Task Create_Honeypot_PretendsSuccess_ButSavesNothing()
    {
        await factory.PrepareAsync();
        var name = $"Бот {Guid.NewGuid():N}";
        var body = Body(name, $"bot-{Guid.NewGuid():N}@test.local");
        body["website"] = "http://spam.example";

        var response = await PostAsync(body, UniqueIp());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var admin = await LoginAdminAsync(_client);
        var list = await GetJsonAsync($"/api/admin/inquiries?q={Uri.EscapeDataString(name)}", admin);
        Assert.Equal(0, list.GetProperty("totalCount").GetInt32());
    }

    [SkippableFact]
    public async Task Create_TooManyFromOneAddress_Returns429()
    {
        await factory.PrepareAsync();
        var ip = UniqueIp();

        for (var i = 0; i < 5; i++)
        {
            var ok = await PostAsync(Body($"Спам {i} {Guid.NewGuid():N}", ""), ip);
            Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        }

        var limited = await PostAsync(Body("Шоста", ""), ip);
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await PostAsync(Body("Інша адреса", ""), UniqueIp())).StatusCode);
    }

    [SkippableFact]
    public async Task AdminInquiries_RequireAdminRole()
    {
        await factory.PrepareAsync();
        var (token, _) = await RegisterCustomerAsync(_client);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/admin/inquiries")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(_client, HttpMethod.Get, "/api/admin/inquiries", token)).StatusCode);
    }

    [SkippableFact]
    public async Task EmailOnlyInquiry_CanBeClosedAndReopened_AndNoteCleared()
    {
        await factory.PrepareAsync();
        var name = $"Email {Guid.NewGuid():N}";
        var body = Body(name, $"email-only-{Guid.NewGuid():N}@test.local");
        body["preferredContact"] = "Email";
        body["phone"] = null;
        body["productSlug"] = "missing-product";
        Assert.Equal(HttpStatusCode.Created, (await PostAsync(body, UniqueIp())).StatusCode);

        var admin = await LoginAdminAsync(_client);
        var list = await GetJsonAsync($"/api/admin/inquiries?q={Uri.EscapeDataString(name)}&status=New&pageSize=1", admin);
        Assert.Equal(1, list.GetProperty("totalCount").GetInt32());
        var id = list.GetProperty("items")[0].GetProperty("id").GetGuid();
        var initial = await GetJsonAsync($"/api/admin/inquiries/{id}", admin);
        Assert.Equal(JsonValueKind.Null, initial.GetProperty("phone").ValueKind);
        Assert.Equal(JsonValueKind.Null, initial.GetProperty("productName").ValueKind);

        foreach (var status in new[] { "InProgress", "Closed", "Spam", "New" })
        {
            var response = await SendAsync(_client, HttpMethod.Put, $"/api/admin/inquiries/{id}", admin,
                new { status, adminNote = "  Нотатка майстра  " });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var persisted = await GetJsonAsync($"/api/admin/inquiries/{id}", admin);
            Assert.Equal(status, persisted.GetProperty("status").GetString());
            Assert.Equal("Нотатка майстра", persisted.GetProperty("adminNote").GetString());
            var filtered = await GetJsonAsync($"/api/admin/inquiries?q={Uri.EscapeDataString(name)}&status={status}", admin);
            Assert.Equal(1, filtered.GetProperty("totalCount").GetInt32());
        }

        (await SendAsync(_client, HttpMethod.Put, $"/api/admin/inquiries/{id}", admin, new { adminNote = " " })).EnsureSuccessStatusCode();
        var cleared = await GetJsonAsync($"/api/admin/inquiries/{id}", admin);
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("adminNote").ValueKind);
        Assert.Equal("New", cleared.GetProperty("status").GetString());
    }

    [SkippableFact]
    public async Task AdminInquiry_InvalidUpdate_DoesNotChangeSavedData()
    {
        await factory.PrepareAsync();
        var name = $"Validation {Guid.NewGuid():N}";
        Assert.Equal(HttpStatusCode.Created, (await PostAsync(Body(name, ""), UniqueIp())).StatusCode);
        var admin = await LoginAdminAsync(_client);
        var list = await GetJsonAsync($"/api/admin/inquiries?q={Uri.EscapeDataString(name)}", admin);
        var id = list.GetProperty("items")[0].GetProperty("id").GetGuid();
        var response = await SendAsync(_client, HttpMethod.Put, $"/api/admin/inquiries/{id}", admin,
            new { status = "Unknown", adminNote = new string('x', 3001) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("status", out _));
        Assert.True(errors.TryGetProperty("adminNote", out _));
        var persisted = await GetJsonAsync($"/api/admin/inquiries/{id}", admin);
        Assert.Equal("New", persisted.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, persisted.GetProperty("adminNote").ValueKind);
    }

    private async Task<JsonElement> GetJsonAsync(string url, string token)
    {
        var response = await SendAsync(_client, HttpMethod.Get, url, token);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(response.IsSuccessStatusCode, $"{url}: {(int)response.StatusCode} {json}");
        return json;
    }
}
