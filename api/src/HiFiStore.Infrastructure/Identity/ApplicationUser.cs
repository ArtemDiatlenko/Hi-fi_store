using Microsoft.AspNetCore.Identity;

namespace HiFiStore.Infrastructure.Identity;

public class ApplicationUser : IdentityUser<Guid>
{
    public string? FullName { get; set; }
}
