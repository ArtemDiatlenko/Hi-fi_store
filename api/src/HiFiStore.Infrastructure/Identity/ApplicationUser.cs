using Microsoft.AspNetCore.Identity;

namespace HiFiStore.Infrastructure.Identity;

public class ApplicationUser : IdentityUser<Guid>
{
    public string? FullName { get; set; }

    /// <summary>
    /// Когда создана учётная запись. Проставляет база (<c>now()</c>) при вставке; у пользователей,
    /// созданных до появления поля, — <c>null</c>: настоящая дата неизвестна.
    /// </summary>
    public DateTimeOffset? RegisteredAt { get; set; }
}
