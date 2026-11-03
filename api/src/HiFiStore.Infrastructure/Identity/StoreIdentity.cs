using Microsoft.AspNetCore.Identity;

namespace HiFiStore.Infrastructure.Identity;

public static class StoreIdentity
{
    /// <summary>
    /// Правила учётных записей и паролей. Одни и те же для веб-приложения (регистрация через API)
    /// и для команды <c>create-admin</c>, которая поднимает Identity без HTTP.
    /// </summary>
    public static void ConfigureOptions(IdentityOptions options)
    {
        options.Password.RequiredLength = 8;
        options.User.RequireUniqueEmail = true;
    }
}
