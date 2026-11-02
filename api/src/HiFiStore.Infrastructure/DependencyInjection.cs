using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HiFiStore.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Регистрирует EF Core (PostgreSQL) и сервисы каталога.
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

        return services;
    }
}
