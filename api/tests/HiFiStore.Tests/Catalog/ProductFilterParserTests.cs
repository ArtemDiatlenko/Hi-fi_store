using HiFiStore.Api.Catalog;
using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Catalog;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;

namespace HiFiStore.Tests.Catalog;

public class ProductFilterParserTests
{
    [Fact]
    public void EmptyQuery_UsesDefaults()
    {
        var ok = ProductFilterParser.TryParse(Query(), out var filter, out var errors);

        Assert.True(ok);
        Assert.Empty(errors);
        Assert.Null(filter.CategorySlug);
        Assert.Equal(CatalogSort.Newest, filter.Sort);
        Assert.Equal(1, filter.Page);
        Assert.Equal(ProductFilterParser.DefaultPageSize, filter.PageSize);
        Assert.Empty(filter.Specs);
    }

    [Fact]
    public void BrandsAndConditions_AcceptCommaSeparatedAndRepeatedValues()
    {
        var ok = ProductFilterParser.TryParse(
            Query(("brand", "aurora,kvarts"), ("brand", "vega"), ("condition", "new"), ("condition", "Used")),
            out var filter,
            out var errors);

        Assert.True(ok, string.Join("; ", errors.Keys));
        Assert.Equal(["aurora", "kvarts", "vega"], filter.BrandSlugs);
        Assert.Equal([ProductCondition.New, ProductCondition.Used], filter.Conditions);
    }

    [Fact]
    public void SpecKinds_AreRecognisedByShape()
    {
        var ok = ProductFilterParser.TryParse(
            Query(
                ("spec.power_w.min", "10"),
                ("spec.power_w.max", "150"),
                ("spec.bluetooth", "true"),
                ("spec.tube_type", "EL34,6V6"),
                ("spec.material", "МДФ")),
            out var filter,
            out var errors);

        Assert.True(ok, string.Join("; ", errors.Keys));

        var power = Assert.Single(filter.Specs, s => s.Key == "power_w");
        Assert.Equal(10m, power.Min);
        Assert.Equal(150m, power.Max);

        var bluetooth = Assert.Single(filter.Specs, s => s.Key == "bluetooth");
        Assert.True(bluetooth.BoolValue);

        var tube = Assert.Single(filter.Specs, s => s.Key == "tube_type");
        Assert.Equal(["EL34", "6V6"], tube.TextValues);

        Assert.Equal(["МДФ"], Assert.Single(filter.Specs, s => s.Key == "material").TextValues);
    }

    [Theory]
    [InlineData("price_asc", CatalogSort.PriceAsc)]
    [InlineData("price_desc", CatalogSort.PriceDesc)]
    [InlineData("name", CatalogSort.Name)]
    [InlineData("newest", CatalogSort.Newest)]
    public void Sort_MapsKnownValues(string value, CatalogSort expected)
    {
        Assert.True(ProductFilterParser.TryParse(Query(("sort", value)), out var filter, out _));
        Assert.Equal(expected, filter.Sort);
    }

    [Theory]
    [InlineData("pageSize", "0")]
    [InlineData("pageSize", "101")]
    [InlineData("page", "0")]
    [InlineData("page", "abc")]
    [InlineData("sort", "random")]
    [InlineData("condition", "broken")]
    [InlineData("minPrice", "-1")]
    [InlineData("inStock", "maybe")]
    public void InvalidValues_ProduceErrorForParameter(string name, string value)
    {
        var ok = ProductFilterParser.TryParse(Query((name, value)), out _, out var errors);

        Assert.False(ok);
        Assert.Contains(name, errors.Keys);
    }

    [Fact]
    public void MinPriceGreaterThanMaxPrice_IsRejected()
    {
        var ok = ProductFilterParser.TryParse(Query(("minPrice", "500"), ("maxPrice", "100")), out _, out var errors);

        Assert.False(ok);
        Assert.Contains("minPrice", errors.Keys);
    }

    [Fact]
    public void SpecRangeWithMinAboveMax_IsRejected()
    {
        var ok = ProductFilterParser.TryParse(
            Query(("spec.power_w.min", "200"), ("spec.power_w.max", "100")),
            out _,
            out var errors);

        Assert.False(ok);
        Assert.Contains("spec.power_w.min", errors.Keys);
    }

    [Theory]
    [InlineData("spec.Power-W", "1")]
    [InlineData("spec.power w", "1")]
    [InlineData("spec.power_w", "")]
    public void MalformedSpecParameters_AreRejected(string name, string value)
    {
        var ok = ProductFilterParser.TryParse(Query((name, value)), out _, out var errors);

        Assert.False(ok);
        Assert.Single(errors);
    }

    [Fact]
    public void PageSize_AtMaximum_IsAccepted()
    {
        Assert.True(ProductFilterParser.TryParse(Query(("pageSize", "100")), out var filter, out _));
        Assert.Equal(100, filter.PageSize);
    }

    private static IQueryCollection Query(params (string Name, string Value)[] pairs)
    {
        var dictionary = new Dictionary<string, StringValues>(StringComparer.OrdinalIgnoreCase);
        foreach (var (name, value) in pairs)
        {
            dictionary[name] = dictionary.TryGetValue(name, out var existing)
                ? StringValues.Concat(existing, value)
                : new StringValues(value);
        }

        return new QueryCollection(dictionary);
    }
}
