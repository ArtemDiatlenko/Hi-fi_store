namespace HiFiStore.Infrastructure.Identity;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";

    public static readonly string[] All = [Admin, Customer];

    /// <summary>
    /// Постоянные идентификаторы ролей. Роли создаются миграцией <c>SeedIdentityRoles</c>
    /// (см. <c>RoleConfiguration</c>), поэтому есть в любой базе после применения миграций.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, Guid> Ids = new Dictionary<string, Guid>
    {
        [Admin] = new("0f28c48c-f65b-4e25-8292-eaf4e9285790"),
        [Customer] = new("32f3d72f-e6ce-4221-bac3-23e76e877509"),
    };
}
