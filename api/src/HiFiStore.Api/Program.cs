using System.Text.Json.Serialization;
using HiFiStore.Api;
using HiFiStore.Api.Cli;
using HiFiStore.Api.Email;
using HiFiStore.Api.Identity;
using HiFiStore.Infrastructure;
using HiFiStore.Infrastructure.Email;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using HiFiStore.Infrastructure.Persistence.Seeding;
using Microsoft.AspNetCore.Identity;

// «migrate», «create-admin» и т. п. — команды обслуживания: выполняются без запуска веб-сервера (см. StoreCli).
var command = CommandLine.Parse(args);
if (command is not CliCommand.RunWebApp)
{
    return await StoreCli.RunAsync(command, Console.Out, Console.Error);
}

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddStoreInfrastructure(builder.Configuration);

// Identity: регистрация, вход по bearer-токену, подтверждение и сброс пароля — из коробки.
builder.Services
    .AddIdentityApiEndpoints<ApplicationUser>(StoreIdentity.ConfigureOptions)
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<StoreDbContext>();

// Письма: Identity (подтверждение email, сброс пароля) и уведомления о заказах уходят через очередь в фоне.
builder.Services.AddSingleton<EmailOutbox>();
builder.Services.AddSingleton<IEmailOutbox>(services => services.GetRequiredService<EmailOutbox>());
builder.Services.AddHostedService<EmailDispatcher>();
builder.Services.AddTransient<IEmailSender<ApplicationUser>, IdentityEmailSender>();

builder.Services.AddAuthorization();
builder.Services.AddInquiryRateLimit();

builder.Services
    .AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Store:AutoMigrate"))
{
    await StoreDbInitializer.InitializeAsync(app.Services, app.Configuration);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapGroup("/api/auth").MapIdentityApi<ApplicationUser>().WithTags("Auth")
    .AddEndpointFilterFactory(CustomerRoleOnRegistration.Create);

await app.RunAsync();
return ExitCodes.Success;

// Нужно для WebApplicationFactory в интеграционных тестах.
public partial class Program
{
}
