using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using static HiFiStore.Tests.Integration.OrderTestHelpers;

namespace HiFiStore.Tests.Integration;

/// <summary>Письма: подтверждение email, восстановление пароля, уведомления о заказах.</summary>
public sealed class AccountEmailApiTests(StoreWebApplicationFactory factory) : IClassFixture<StoreWebApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [SkippableFact]
    public async Task Register_SendsStorefrontConfirmLink_ThatConfirmsEmail()
    {
        await factory.PrepareAsync();
        var email = await _client.RegisterNewUserAsync("confirm");

        var token = await _client.LoginAsync(email, HttpClientAuthExtensions.CustomerPassword);
        Assert.False((await GetMeAsync(token)).GetProperty("emailConfirmed").GetBoolean());

        Assert.Equal(HttpStatusCode.OK, await ConfirmFromLetterAsync(email));
        Assert.True((await GetMeAsync(token)).GetProperty("emailConfirmed").GetBoolean());
    }

    [SkippableFact]
    public async Task ForgotPassword_UnconfirmedEmail_SendsNothing()
    {
        await factory.PrepareAsync();
        var email = await _client.RegisterNewUserAsync("unconfirmed");

        // Identity отвечает 200 в любом случае, чтобы по ответу нельзя было узнать, есть ли такой аккаунт.
        (await _client.PostAsJsonAsync("/api/auth/forgotPassword", new { email })).EnsureSuccessStatusCode();

        await Task.Delay(500);
        Assert.DoesNotContain(factory.Emails.To(email), m => m.Subject.Contains("Відновлення пароля"));
    }

    [SkippableFact]
    public async Task ForgotPassword_SendsResetLink_ThatSetsNewPassword()
    {
        await factory.PrepareAsync();
        var email = await _client.RegisterNewUserAsync("reset");
        // Identity присылает письмо сброса только на подтверждённый адрес.
        Assert.Equal(HttpStatusCode.OK, await ConfirmFromLetterAsync(email));

        (await _client.PostAsJsonAsync("/api/auth/forgotPassword", new { email })).EnsureSuccessStatusCode();
        var letter = await factory.Emails.WaitForAsync(email, "Відновлення пароля");
        var query = QueryHelpers.ParseQuery(CapturedEmails.LinkIn(letter, StoreWebApplicationFactory.PublicUrl + "/reset-password?").Query);
        Assert.Equal(email, query["email"].ToString());

        const string newPassword = "New-password-2026";
        var reset = await _client.PostAsJsonAsync("/api/auth/resetPassword",
            new { email, resetCode = query["code"].ToString(), newPassword });

        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        Assert.False(string.IsNullOrEmpty(await _client.LoginAsync(email, newPassword)));
    }

    [SkippableFact]
    public async Task PlaceOrder_EmailsCustomerAndOwner_StatusChangeEmailsCustomer()
    {
        await factory.PrepareAsync();
        var product = await CreateProductAsync(factory, stock: 5);
        var (token, email) = await RegisterCustomerAsync(_client);
        var body = CheckoutBody((product.Id, 1));
        body["email"] = email;

        var placed = await PlaceOrderAsync(_client, body, token);
        var order = placed.GetProperty("order");
        var number = order.GetProperty("number").GetInt64();
        var id = order.GetProperty("id").GetGuid();

        var customerLetter = await factory.Emails.WaitForAsync(email, $"Замовлення №{number} прийнято");
        Assert.Contains(product.Name, customerLetter.Text);
        CapturedEmails.LinkIn(customerLetter, $"{StoreWebApplicationFactory.PublicUrl}/orders/{placed.GetProperty("token").GetString()}");

        var ownerLetter = await factory.Emails.WaitForAsync(StoreWebApplicationFactory.OwnerEmail, $"Нове замовлення №{number}");
        CapturedEmails.LinkIn(ownerLetter, $"{StoreWebApplicationFactory.PublicUrl}/admin/order/{id}");

        var admin = await LoginAdminAsync(_client);
        (await SendAsync(_client, HttpMethod.Put, $"/api/admin/orders/{id}/status", admin, new { status = "Confirmed" }))
            .EnsureSuccessStatusCode();

        var statusLetter = await factory.Emails.WaitForAsync(email, $"Замовлення №{number}: підтверджено");
        CapturedEmails.LinkIn(statusLetter, $"{StoreWebApplicationFactory.PublicUrl}/account/orders/{id}");
    }

    /// <summary>Берёт ссылку из письма подтверждения и выполняет то, что делает страница витрины /confirm-email.</summary>
    private async Task<HttpStatusCode> ConfirmFromLetterAsync(string email)
    {
        var letter = await factory.Emails.WaitForAsync(email, "Підтвердіть email");
        var link = CapturedEmails.LinkIn(letter, StoreWebApplicationFactory.PublicUrl + "/confirm-email?");
        var query = QueryHelpers.ParseQuery(link.Query);
        var response = await _client.GetAsync(QueryHelpers.AddQueryString("/api/auth/confirmEmail", new Dictionary<string, string?>
        {
            ["userId"] = query["userId"],
            ["code"] = query["code"],
        }));
        return response.StatusCode;
    }

    private async Task<JsonElement> GetMeAsync(string token)
    {
        var response = await SendAsync(_client, HttpMethod.Get, "/api/account/me", token);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
