using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HiFiStore.Api;

/// <summary>
/// Ограничение частоты заявок: не больше <see cref="PermitLimit"/> за <see cref="Window"/> с одного адреса.
/// API стоит за прокси (Render, Next), поэтому адрес берётся из первого значения X-Forwarded-For, а без него — из соединения.
/// Заголовок можно подделать, так что это защита от случайного спама и простых ботов, а не от целенаправленной атаки.
/// </summary>
public static class InquiryRateLimit
{
    public const string Policy = "inquiries";
    public const int PermitLimit = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(10);

    public static IServiceCollection AddInquiryRateLimit(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.AddPolicy(Policy, context => RateLimitPartition.GetFixedWindowLimiter(
                ClientKey(context),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = PermitLimit, Window = Window, QueueLimit = 0 }));

            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Слишком много заявок.",
                    Detail = "Вы уже отправили несколько заявок. Попробуйте позже или свяжитесь с нами по телефону.",
                }, ct);
            };
        });

    private static string ClientKey(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            return forwarded.Split(',')[0].Trim();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
