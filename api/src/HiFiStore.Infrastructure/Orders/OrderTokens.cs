using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace HiFiStore.Infrastructure.Orders;

/// <summary>
/// Публичный токен страницы подтверждения заказа: 256 случайных бит в base64url (43 символа).
/// В базе хранится только SHA-256 от токена, поэтому утечка таблицы заказов не раскрывает ссылки.
/// </summary>
public static class OrderTokens
{
    public const int Length = 43;

    public static (string Token, string Hash) Create()
    {
        var token = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        return (token, Hash(token));
    }

    public static string Hash(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.ASCII.GetBytes(token)));

    /// <summary>Отсекает заведомо неверные токены до обращения к базе.</summary>
    public static bool IsWellFormed(string? token) =>
        token is { Length: Length } &&
        token.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');
}
