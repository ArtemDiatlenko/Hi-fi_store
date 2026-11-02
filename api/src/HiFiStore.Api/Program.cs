using System.Text.Json.Serialization;
using HiFiStore.Infrastructure;
using HiFiStore.Infrastructure.Identity;
using HiFiStore.Infrastructure.Persistence;
using HiFiStore.Infrastructure.Persistence.Seeding;
using Microsoft.AspNetCore.Identity;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddStoreInfrastructure(builder.Configuration);

// Identity: регистрация, вход по bearer-токену, подтверждение и сброс пароля — из коробки.
builder.Services
    .AddIdentityApiEndpoints<ApplicationUser>(options =>
    {
        options.Password.RequiredLength = 8;
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<StoreDbContext>();

builder.Services.AddAuthorization();

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

app.MapControllers();
app.MapGroup("/api/auth").MapIdentityApi<ApplicationUser>().WithTags("Auth");

app.Run();

// Нужно для WebApplicationFactory в интеграционных тестах.
public partial class Program
{
}
