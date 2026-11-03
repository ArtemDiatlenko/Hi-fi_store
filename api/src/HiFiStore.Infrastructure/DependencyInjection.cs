using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Catalog.Admin;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Orders;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace HiFiStore.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Регистрирует EF Core (PostgreSQL), сервисы каталога, заказов и административного каталога.
    /// Identity-эндпоинты настраиваются в API-проекте, так как они зависят от ASP.NET Core.
    /// </summary>
    public static IServiceCollection AddStoreInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Store")
            ?? throw new InvalidOperationException(
                "Не задана строка подключения ConnectionStrings:Store. " +
                "Задайте переменную окружения ConnectionStrings__Store или dotnet user-secrets.");

        services.AddDbContext<StoreDbContext>(options => options.UseNpgsql(NormalizeConnectionString(connectionString)));
        services.AddScoped<ICatalogService, CatalogService>();
        services.AddScoped<IOrderService, OrderService>();

        // Административный каталог. Время берётся из TimeProvider, чтобы в тестах его можно было подменить.
        services.TryAddSingleton(TimeProvider.System);
        services.AddScoped<IAdminBrandService, AdminBrandService>();
        services.AddScoped<IAdminCategoryService, AdminCategoryService>();
        services.AddScoped<IAdminProductService, AdminProductService>();

        // Учётные записи администраторов (create-admin, Seed:Admin). UserManager регистрирует Identity в API-проекте.
        services.AddScoped<AdminAccountService>();

        return services;
    }

    /// <summary>
    /// Render отдаёт строку подключения в виде URI (postgres://user:pass@host:port/db), а Npgsql ждёт формат key=value.
    /// Обычная строка key=value возвращается как есть.
    /// </summary>
    private static string NormalizeConnectionString(string connectionString)
    {
        if (!connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return connectionString;
        }

        var uri = new Uri(connectionString);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
        };

        return builder.ConnectionString;
    }
}
