using System.Net;
using System.Net.Http.Json;

namespace HiFiStore.Tests.Integration.Admin;

public sealed class AdminAuthorizationTests(StoreWebApplicationFactory factory) : AdminApiTestBase(factory)
{
    public static TheoryData<string> AdminUrls =>
    [
        "/api/admin/brands",
        "/api/admin/categories",
        "/api/admin/products",
    ];

    [SkippableTheory]
    [MemberData(nameof(AdminUrls))]
    public async Task Anonymous_GetsUnauthorized(string url)
    {
        await PrepareAsync();

        var response = await Anonymous.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [SkippableTheory]
    [MemberData(nameof(AdminUrls))]
    public async Task Customer_GetsForbidden(string url)
    {
        await PrepareAsync();
        using var customer = await Factory.CreateCustomerClientAsync();

        var response = await customer.GetAsync(url);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [SkippableTheory]
    [MemberData(nameof(AdminUrls))]
    public async Task Admin_GetsOk(string url)
    {
        await PrepareAsync();

        var response = await Admin.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [SkippableFact]
    public async Task Anonymous_CannotCreateBrand()
    {
        await PrepareAsync();

        var response = await Anonymous.PostAsJsonAsync("/api/admin/brands", new { name = $"Аноним {NewSuffix()}" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [SkippableFact]
    public async Task Customer_CannotDeleteBrand()
    {
        await PrepareAsync();
        var brandId = await CreateBrandAsync(NewSuffix());
        using var customer = await Factory.CreateCustomerClientAsync();

        var response = await customer.DeleteAsync($"/api/admin/brands/{brandId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await GetAsync($"/api/admin/brands/{brandId}");
    }
}
