using HiFiStore.Api;
using HiFiStore.Api.Catalog;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;

namespace HiFiStore.Tests.Catalog;

public class AdminProductQueryParserTests
{
    [Fact]
    public void EmptyQuery_UsesDefaults()
    {
        var ok = AdminProductQueryParser.TryParse(Query(), out var query, out var errors);

        Assert.True(ok);
        Assert.Empty(errors);
        Assert.Null(query.Search);
        Assert.Null(query.CategoryId);
        Assert.Null(query.IsPublished);
        Assert.Equal(1, query.Page);
        Assert.Equal(Paging.DefaultPageSize, query.PageSize);
    }

    [Fact]
    public void ValidValues_AreParsed()
    {
        var categoryId = Guid.NewGuid();
        var brandId = Guid.NewGuid();

        var ok = AdminProductQueryParser.TryParse(
            Query(("q", " au-i80 "), ("categoryId", categoryId.ToString()), ("brandId", brandId.ToString()),
                ("published", "false"), ("page", "3"), ("pageSize", "50")),
            out var query,
            out var errors);

        Assert.True(ok, string.Join("; ", errors.Keys));
        Assert.Equal("au-i80", query.Search);
        Assert.Equal(categoryId, query.CategoryId);
        Assert.Equal(brandId, query.BrandId);
        Assert.False(query.IsPublished);
        Assert.Equal(3, query.Page);
        Assert.Equal(50, query.PageSize);
    }

    [Fact]
    public void EmptyValues_AreIgnored()
    {
        var ok = AdminProductQueryParser.TryParse(
            Query(("categoryId", ""), ("published", " "), ("page", "")), out var query, out var errors);

        Assert.True(ok, string.Join("; ", errors.Keys));
        Assert.Null(query.CategoryId);
        Assert.Null(query.IsPublished);
        Assert.Equal(1, query.Page);
    }

    [Fact]
    public void InvalidValues_ReturnErrorsPerParameter()
    {
        var ok = AdminProductQueryParser.TryParse(
            Query(("categoryId", "abc"), ("brandId", "1"), ("published", "yes"), ("page", "0"), ("pageSize", "101")),
            out _,
            out var errors);

        Assert.False(ok);
        Assert.Equal(["brandId", "categoryId", "page", "pageSize", "published"], errors.Keys.Order());
    }

    private static QueryCollection Query(params (string Key, string Value)[] pairs) =>
        new(pairs
            .GroupBy(p => p.Key)
            .ToDictionary(g => g.Key, g => new StringValues(g.Select(p => p.Value).ToArray())));
}
