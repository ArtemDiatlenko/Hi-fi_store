using HiFiStore.Domain.Catalog;
using System.Net;
using HiFiStore.Infrastructure.Email;
using HiFiStore.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;

namespace HiFiStore.Api.Email;

/// <summary>
/// Письма стандартных эндпоинтов Identity (<c>/api/auth/register</c>, <c>resendConfirmationEmail</c>,
/// <c>forgotPassword</c>). Identity строит ссылку подтверждения на сам API; покупателю же нужна страница
/// витрины, поэтому из ссылки берутся параметры, а адрес собирается от <c>Store:PublicUrl</c>.
/// Страницы витрины сами вызывают <c>/api/auth/confirmEmail</c> и <c>/api/auth/resetPassword</c>.
/// </summary>
/// <para>
/// Язык письма — из параметра <c>lang</c> запроса (витрина передаёт его при регистрации и восстановлении пароля):
/// письмо и ссылка в нём на том же языке, что и страница, с которой пришёл покупатель.
/// </para>
public sealed class IdentityEmailSender(IEmailOutbox outbox, StoreLinkOptions links, IHttpContextAccessor http) : IEmailSender<ApplicationUser>
{
    private string Locale => ContentLocales.Resolve(http.HttpContext?.Request.Query["lang"].ToString());

    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
    {
        outbox.Enqueue(EmailTemplates.ConfirmEmail(email, StorefrontConfirmLink(confirmationLink), Locale));
        return Task.CompletedTask;
    }

    // MapIdentityApi присылает код, а не ссылку: ссылка собирается здесь.
    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
    {
        var link = QueryHelpers.AddQueryString(
            links.Link("/reset-password", Locale),
            new Dictionary<string, string?> { ["email"] = email, ["code"] = WebUtility.HtmlDecode(resetCode) });
        outbox.Enqueue(EmailTemplates.ResetPassword(email, link, Locale));
        return Task.CompletedTask;
    }

    // MapIdentityApi этот метод не вызывает (только SendPasswordResetCodeAsync); оставлен для полноты интерфейса.
    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
    {
        outbox.Enqueue(EmailTemplates.ResetPassword(email, WebUtility.HtmlDecode(resetLink), Locale));
        return Task.CompletedTask;
    }

    /// <summary>
    /// Ссылка Identity вида <c>https://api/…/confirmEmail?userId=…&amp;code=…[&amp;changedEmail=…]</c> (HTML-закодирована)
    /// → <c>{PublicUrl}/confirm-email?userId=…&amp;code=…[&amp;changedEmail=…]</c>.
    /// </summary>
    public string StorefrontConfirmLink(string confirmationLink)
    {
        var apiLink = new Uri(WebUtility.HtmlDecode(confirmationLink));
        var query = QueryHelpers.ParseQuery(apiLink.Query);
        var parameters = new Dictionary<string, string?>();
        foreach (var name in new[] { "userId", "code", "changedEmail" })
        {
            if (query.TryGetValue(name, out var value) && !string.IsNullOrEmpty(value))
            {
                parameters[name] = value.ToString();
            }
        }

        return QueryHelpers.AddQueryString(links.Link("/confirm-email", Locale), parameters);
    }
}
