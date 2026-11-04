using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Catalog.Admin;
using HiFiStore.Infrastructure.Email;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Inquiries;
using HiFiStore.Infrastructure.Media;
using HiFiStore.Infrastructure.Orders;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
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
        // Ключи ссылок подтверждения, восстановления пароля и сессий переживают перезапуск контейнера.
        services.AddDataProtection().SetApplicationName("HiFiStore").PersistKeysToDbContext<StoreDbContext>();
        services.AddScoped<ICatalogService, CatalogService>();
        services.AddScoped<IOrderService, OrderService>();

        // Административный каталог. Время берётся из TimeProvider, чтобы в тестах его можно было подменить.
        services.TryAddSingleton(TimeProvider.System);
        services.AddScoped<IAdminBrandService, AdminBrandService>();
        services.AddScoped<IAdminCategoryService, AdminCategoryService>();
        services.AddScoped<IAdminProductService, AdminProductService>();

        // Учётные записи администраторов (create-admin, Seed:Admin). UserManager регистрирует Identity в API-проекте.
        services.AddScoped<AdminAccountService>();
        services.AddScoped<IAdminCustomerService, AdminCustomerService>();
        services.AddScoped<IInquiryService, InquiryService>();

        // Почта: по умолчанию демонстрация в логе; HTTP API Resend или SMTP подключаются настройками.
        // Очередь (IEmailOutbox) и фоновую отправку
        // регистрирует API-проект — ей нужен хост приложения.
        var email = configuration.GetSection(EmailOptions.Section).Get<EmailOptions>() ?? new EmailOptions();
        EmailTransportFactory.Validate(email);
        services.AddSingleton(email);
        services.AddSingleton(configuration.GetSection("Store").Get<StoreLinkOptions>() ?? new StoreLinkOptions());
        if (EmailTransportFactory.Provider(email) == "resend")
        {
            services.AddHttpClient(ResendEmailTransport.ClientName, client => client.Timeout = TimeSpan.FromSeconds(30));
            services.TryAddSingleton<IEmailTransport, ResendEmailTransport>();
        }
        else if (EmailTransportFactory.Provider(email) == "smtp")
        {
            services.TryAddSingleton<IEmailTransport, SmtpEmailTransport>();
        }
        else
        {
            services.TryAddSingleton<IEmailTransport, LogEmailTransport>();
        }

        services.AddScoped<OrderNotifier>();

        AddMedia(services, configuration);

        return services;
    }

    /// <summary>Хранилище загруженных файлов: Disk (по умолчанию) или S3 — см. <see cref="MediaOptions"/>.</summary>
    private static void AddMedia(IServiceCollection services, IConfiguration configuration)
    {
        var media = configuration.GetSection(MediaOptions.Section).Get<MediaOptions>() ?? new MediaOptions();
        if (media.MaxImageBytes <= 0)
        {
            throw new InvalidOperationException("Media:MaxImageBytes должен быть больше нуля.");
        }

        services.AddSingleton(media);
        services.AddScoped<ProductImageUploader>();

        switch (media.Provider?.Trim().ToLowerInvariant())
        {
            case "s3":
                S3MediaStorage.Validate(media.S3);
                services.TryAddSingleton<IMediaStorage>(_ => new S3MediaStorage(media.S3));
                break;
            case "disk" or "" or null:
                // Относительный путь — от каталога приложения (content root), а не от папки сборки bin/.
                var contentRoot = configuration["contentRoot"] ?? Directory.GetCurrentDirectory();
                var root = Path.IsPathRooted(media.Disk.Path) ? media.Disk.Path : Path.Combine(contentRoot, media.Disk.Path);
                services.TryAddSingleton<IMediaStorage>(_ => new DiskMediaStorage(root));
                break;
            default:
                throw new InvalidOperationException("Media:Provider должен быть Disk или S3.");
        }
    }
}
