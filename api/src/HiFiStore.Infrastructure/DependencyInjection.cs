using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Catalog.Admin;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Orders;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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

        services.AddDbContext<StoreDbContext>(options => options.UseNpgsql(connectionString));
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
}
