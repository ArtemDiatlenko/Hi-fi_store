using HiFiStore.Api;
using HiFiStore.Api.Catalog;
using HiFiStore.Api.Orders;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;

namespace HiFiStore.Tests;

public class PagingTests
{
    [Fact]
    public void Defaults_WhenMissingOrEmpty()
    {
        var errors = new Dictionary<string, string[]>();

        var (page, pageSize) = Paging.Parse(Query(("page", " "), ("pageSize", "")), errors);

        Assert.Empty(errors);
        Assert.Equal(1, page);
        Assert.Equal(Paging.DefaultPageSize, pageSize);
    }

    [Fact]
    public void Bounds_AreInclusive()
    {
        var errors = new Dictionary<string, string[]>();

        var (page, pageSize) = Paging.Parse(Query(("page", Paging.MaxPage.ToString()), ("pageSize", "100")), errors);

        Assert.Empty(errors);
        Assert.Equal(Paging.MaxPage, page);
        Assert.Equal(Paging.MaxPageSize, pageSize);
        // Смещение последней допустимой страницы помещается в int.
        Assert.True((long)(page - 1) * pageSize <= int.MaxValue);
    }

    [Theory]
    [InlineData("0", "20")]
    [InlineData("2147483647", "20")]
    [InlineData("1", "0")]
    [InlineData("1", "101")]
    [InlineData("abc", "1.5")]
    public void OutOfRange_IsReportedByParameterName(string page, string pageSize)
    {
        var errors = new Dictionary<string, string[]>();

        Paging.Parse(Query(("page", page), ("pageSize", pageSize)), errors);

        Assert.NotEmpty(errors);
        Assert.All(errors.Keys, key => Assert.Contains(key, new[] { "page", "pageSize" }));
    }

    /// <summary>
    /// Раньше каталог и список товаров в админке принимали page до int.MaxValue: смещение переполнялось,
    /// и запрос падал с 500. Теперь все списки ограничивают номер страницы одинаково.
    /// </summary>
    [Fact]
    public void AllListParsers_RejectPageThatWouldOverflowOffset()
    {
        var query = Query(("page", int.MaxValue.ToString()), ("pageSize", "100"));

        Assert.False(ProductFilterParser.TryParse(query, out _, out var catalogErrors));
        Assert.False(AdminProductQueryParser.TryParse(query, out _, out var adminErrors));
        Assert.False(OrderQueryParser.TryParsePaging(query, out _, out _, out var orderErrors));
        Assert.False(OrderQueryParser.TryParseAdminFilter(query, out _, out var adminOrderErrors));

        foreach (var errors in new[] { catalogErrors, adminErrors, orderErrors, adminOrderErrors })
        {
            Assert.Equal(["page"], errors.Keys);
        }
    }

    private static QueryCollection Query(params (string Key, string Value)[] pairs) =>
        new(pairs.ToDictionary(p => p.Key, p => new StringValues(p.Value)));
}
