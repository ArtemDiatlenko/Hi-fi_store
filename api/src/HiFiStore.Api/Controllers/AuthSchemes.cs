namespace HiFiStore.Api.Controllers;

internal static class AuthSchemes
{
    /// <summary>
    /// Схема bearer-токенов, которую регистрирует AddIdentityApiEndpoints. Совпадает с
    /// <c>IdentityConstants.BearerScheme</c>, но та не константа и не годится для атрибутов.
    /// </summary>
    public const string IdentityBearer = "Identity.Bearer";
}
