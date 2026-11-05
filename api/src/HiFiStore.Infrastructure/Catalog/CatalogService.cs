using System.Linq.Expressions;
using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Catalog;

public sealed class CatalogService(StoreDbContext db) : ICatalogService
{
    private sealed record CategoryRow(Guid Id, Guid? ParentId, string Name, string Slug, int SortOrder);

    private sealed record DefinitionRow(Guid Id, string Key, string Name, string? Unit, SpecValueType ValueType, int SortOrder);

    /// <param name="TextLabel">Перевод текстового значения на язык страницы, если есть.</param>
    private sealed record SpecValueRow(Guid SpecDefinitionId, decimal? NumberValue, string? TextValue, bool? BoolValue, string? TextLabel);

    public async Task<IReadOnlyList<CategoryNode>> GetCategoryTreeAsync(string locale = ContentLocales.Base, CancellationToken ct = default)
    {
        var rows = await LoadCategoryRowsAsync(locale, ct);
        var childrenByParent = rows.ToLookup(r => r.ParentId);
        return BuildTree(childrenByParent, null);
    }

    public async Task<PagedResult<ProductListItem>?> ListProductsAsync(
        ProductFilter filter, string locale = ContentLocales.Base, CancellationToken ct = default)
    {
        IQueryable<Product> query = db.Products.AsNoTracking().Where(p => p.IsPublished);

        if (filter.CategorySlug is not null)
        {
            var scope = await ResolveCategoryScopeAsync(filter.CategorySlug, locale, ct);
            if (scope is null)
            {
                return null;
            }

            query = query.Where(p => scope.Contains(p.CategoryId));
        }

        if (filter.BrandSlugs.Count > 0)
        {
            var brands = filter.BrandSlugs;
            query = query.Where(p => brands.Contains(p.Brand.Slug));
        }

        if (filter.Conditions.Count > 0)
        {
            var conditions = filter.Conditions;
            query = query.Where(p => conditions.Contains(p.Condition));
        }

        if (filter.MinPrice is { } minPrice)
        {
            query = query.Where(p => p.Price >= minPrice);
        }

        if (filter.MaxPrice is { } maxPrice)
        {
            query = query.Where(p => p.Price <= maxPrice);
        }

        if (filter.InStockOnly)
        {
            query = query.Where(p => p.Stock > 0);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            // Ищем и по основному названию, и по переводу на язык страницы.
            var term = filter.Search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(term) ||
                                     p.Translations.Any(t => t.Locale == locale && t.Name.ToLower().Contains(term)));
        }

        foreach (var spec in filter.Specs)
        {
            query = query.Where(SpecPredicate(spec));
        }

        var total = await query.CountAsync(ct);

        var sorted = filter.Sort switch
        {
            CatalogSort.PriceAsc => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            CatalogSort.PriceDesc => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            CatalogSort.Name => query
                .OrderBy(p => p.Translations.Where(t => t.Locale == locale).Select(t => t.Name).FirstOrDefault() ?? p.Name)
                .ThenBy(p => p.Id),
            _ => query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id),
        };

        var items = await sorted
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(p => new ProductListItem(
                p.Id,
                p.Sku,
                p.Translations.Where(t => t.Locale == locale).Select(t => t.Name).FirstOrDefault() ?? p.Name,
                p.Slug,
                p.Price,
                p.OldPrice,
                p.Stock > 0,
                p.Condition,
                new BrandRef(p.Brand.Name, p.Brand.Slug),
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()))
            .ToListAsync(ct);

        return new PagedResult<ProductListItem>(items, filter.Page, filter.PageSize, total);
    }

    public async Task<ProductDetails?> GetProductAsync(string slug, string locale = ContentLocales.Base, CancellationToken ct = default)
    {
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Slug == slug && p.IsPublished)
            .Select(p => new
            {
                p.Id,
                p.Sku,
                p.Name,
                p.Slug,
                p.ShortDescription,
                p.Description,
                Translation = p.Translations
                    .Where(t => t.Locale == locale)
                    .Select(t => new { t.Name, t.ShortDescription, t.Description })
                    .FirstOrDefault(),
                CategoryName = p.Category.Translations.Where(t => t.Locale == locale).Select(t => t.Name).FirstOrDefault()
                               ?? p.Category.Name,
                p.Price,
                p.OldPrice,
                p.Stock,
                p.Condition,
                Brand = new BrandRef(p.Brand.Name, p.Brand.Slug),
                CategorySlug = p.Category.Slug,
            })
            .FirstOrDefaultAsync(ct);

        if (product is null)
        {
            return null;
        }

        // Переведённые поля пустые — показываем основной текст.
        var translated = product.Translation;
        var name = translated?.Name ?? product.Name;
        var shortDescription = string.IsNullOrWhiteSpace(translated?.ShortDescription) ? product.ShortDescription : translated.ShortDescription;
        var description = string.IsNullOrWhiteSpace(translated?.Description) ? product.Description : translated.Description;

        var images = await db.ProductImages.AsNoTracking()
            .Where(i => i.ProductId == product.Id)
            .OrderBy(i => i.SortOrder)
            .Select(i => new ImageDto(i.Url, i.Alt))
            .ToListAsync(ct);
        if (locale != ContentLocales.Base)
        {
            // Подписи фото хранятся только на основном языке: для перевода подставляем название товара.
            images = images.Select(i => i with { Alt = name }).ToList();
        }

        var specs = await db.ProductSpecs.AsNoTracking()
            .Where(s => s.ProductId == product.Id)
            .OrderBy(s => s.SpecDefinition.SortOrder)
            .Select(s => new
            {
                s.SpecDefinition.Key,
                Name = s.SpecDefinition.Translations.Where(t => t.Locale == locale).Select(t => t.Name).FirstOrDefault()
                       ?? s.SpecDefinition.Name,
                Unit = s.SpecDefinition.Translations.Where(t => t.Locale == locale).Select(t => t.Unit).FirstOrDefault()
                       ?? s.SpecDefinition.Unit,
                s.SpecDefinition.ValueType,
                s.NumberValue,
                TextValue = s.Translations.Where(t => t.Locale == locale).Select(t => t.TextValue).FirstOrDefault() ?? s.TextValue,
                s.BoolValue,
            })
            .ToListAsync(ct);

        var specDtos = specs
            .Select(s => new SpecValueDto(
                s.Key,
                s.Name,
                s.Unit,
                s.ValueType,
                s.ValueType switch
                {
                    SpecValueType.Number => s.NumberValue,
                    SpecValueType.Boolean => s.BoolValue,
                    _ => s.TextValue,
                }))
            .ToList();

        return new ProductDetails(
            product.Id,
            product.Sku,
            name,
            product.Slug,
            shortDescription,
            description,
            product.Price,
            product.OldPrice,
            product.Stock,
            product.Condition,
            product.Brand,
            new CategoryRef(product.CategoryName, product.CategorySlug),
            images,
            specDtos);
    }

    public async Task<CatalogFacets?> GetFacetsAsync(
        string? categorySlug, string locale = ContentLocales.Base, CancellationToken ct = default)
    {
        IQueryable<Product> products = db.Products.AsNoTracking().Where(p => p.IsPublished);
        HashSet<Guid>? scope = null;

        if (categorySlug is not null)
        {
            scope = await ResolveCategoryScopeAsync(categorySlug, locale, ct);
            if (scope is null)
            {
                return null;
            }

            var ids = scope;
            products = products.Where(p => ids.Contains(p.CategoryId));
        }

        // Дистинкт в SQL, сортировка на клиенте: EF не транслирует ORDER BY по полю после DISTINCT с record-проекцией.
        var brands = (await products
                .Select(p => new { p.Brand.Name, p.Brand.Slug })
                .Distinct()
                .ToListAsync(ct))
            .OrderBy(b => b.Name)
            .Select(b => new BrandRef(b.Name, b.Slug))
            .ToList();

        var conditions = (await products
                .Select(p => p.Condition)
                .Distinct()
                .ToListAsync(ct))
            .OrderBy(c => c)
            .ToList();

        var minPrice = await products.MinAsync(p => (decimal?)p.Price, ct);
        var maxPrice = await products.MaxAsync(p => (decimal?)p.Price, ct);

        // Фасеты характеристик строятся только внутри раздела: без раздела у разных категорий разный набор.
        var specs = scope is null
            ? new List<SpecFacet>()
            : await BuildSpecFacetsAsync(scope, locale, ct);

        return new CatalogFacets(brands, conditions, minPrice, maxPrice, specs);
    }

    private async Task<List<SpecFacet>> BuildSpecFacetsAsync(HashSet<Guid> scope, string locale, CancellationToken ct)
    {
        var definitions = (await db.SpecDefinitions.AsNoTracking()
                .Where(d => scope.Contains(d.CategoryId) && d.IsFilterable)
                .Select(d => new DefinitionRow(
                    d.Id,
                    d.Key,
                    d.Translations.Where(t => t.Locale == locale).Select(t => t.Name).FirstOrDefault() ?? d.Name,
                    d.Translations.Where(t => t.Locale == locale).Select(t => t.Unit).FirstOrDefault() ?? d.Unit,
                    d.ValueType,
                    d.SortOrder))
                .ToListAsync(ct))
            .OrderBy(d => d.SortOrder)
            .ThenBy(d => d.Name)
            .ToList();

        if (definitions.Count == 0)
        {
            return [];
        }

        // Один и тот же ключ (например, power_w) может быть объявлен в нескольких разделах:
        // фасет строится по ключу, а значения собираются со всех таких определений.
        var keyByDefinition = definitions.ToDictionary(d => d.Id, d => d.Key);
        var definitionIds = definitions.Select(d => d.Id).ToList();

        var values = await db.ProductSpecs.AsNoTracking()
            .Where(s => definitionIds.Contains(s.SpecDefinitionId) && s.Product.IsPublished)
            .Select(s => new SpecValueRow(
                s.SpecDefinitionId,
                s.NumberValue,
                s.TextValue,
                s.BoolValue,
                s.Translations.Where(t => t.Locale == locale).Select(t => t.TextValue).FirstOrDefault()))
            .ToListAsync(ct);

        var valuesByKey = values
            .GroupBy(v => keyByDefinition[v.SpecDefinitionId])
            .ToDictionary(g => g.Key, g => g.ToList());

        return definitions
            .GroupBy(d => d.Key)
            .Select(g =>
            {
                var first = g.First();
                var rows = valuesByKey.GetValueOrDefault(g.Key) ?? new List<SpecValueRow>();
                return first.ValueType switch
                {
                    SpecValueType.Number => new SpecFacet(
                        g.Key, first.Name, first.Unit, first.ValueType,
                        rows.Select(r => r.NumberValue).Where(v => v is not null).Min(),
                        rows.Select(r => r.NumberValue).Where(v => v is not null).Max(),
                        null,
                        null),
                    SpecValueType.Text => new SpecFacet(
                        g.Key, first.Name, first.Unit, first.ValueType, null, null,
                        rows.Where(r => r.TextValue is not null)
                            .Select(r => r.TextValue!)
                            .Distinct()
                            .Order()
                            .ToList(),
                        TextLabels(rows)),
                    _ => new SpecFacet(g.Key, first.Name, first.Unit, first.ValueType, null, null, null, null),
                };
            })
            .OrderBy(f => f.Name)
            .ToList();
    }

    /// <summary>
    /// Подписи значений на языке страницы: значение в фильтре остаётся основным («Дерево»), подпись — переводом.
    /// <c>null</c>, если переводов нет.
    /// </summary>
    private static IReadOnlyDictionary<string, string>? TextLabels(List<SpecValueRow> rows)
    {
        var labels = rows
            .Where(r => r.TextValue is not null && r.TextLabel is not null)
            .GroupBy(r => r.TextValue!)
            .ToDictionary(g => g.Key, g => g.First().TextLabel!);
        return labels.Count == 0 ? null : labels;
    }

    private static Expression<Func<Product, bool>> SpecPredicate(SpecFilter spec)
    {
        var key = spec.Key;

        if (spec.BoolValue is { } flag)
        {
            return p => p.Specs.Any(v => v.SpecDefinition.Key == key && v.BoolValue == flag);
        }

        if (spec.TextValues is { Count: > 0 } texts)
        {
            return p => p.Specs.Any(v => v.SpecDefinition.Key == key && texts.Contains(v.TextValue));
        }

        var lower = spec.Min ?? decimal.MinValue;
        var upper = spec.Max ?? decimal.MaxValue;
        return p => p.Specs.Any(v => v.SpecDefinition.Key == key && v.NumberValue >= lower && v.NumberValue <= upper);
    }

    private async Task<List<CategoryRow>> LoadCategoryRowsAsync(string locale, CancellationToken ct) =>
        await db.Categories.AsNoTracking()
            .Select(c => new CategoryRow(
                c.Id,
                c.ParentId,
                c.Translations.Where(t => t.Locale == locale).Select(t => t.Name).FirstOrDefault() ?? c.Name,
                c.Slug,
                c.SortOrder))
            .ToListAsync(ct);

    /// <summary>Идентификаторы раздела и всех его потомков; <c>null</c>, если раздела нет.</summary>
    private async Task<HashSet<Guid>?> ResolveCategoryScopeAsync(string slug, string locale, CancellationToken ct)
    {
        var rows = await LoadCategoryRowsAsync(locale, ct);
        var root = rows.FirstOrDefault(r => r.Slug == slug);
        if (root is null)
        {
            return null;
        }

        var childrenByParent = rows.ToLookup(r => r.ParentId);
        var result = new HashSet<Guid>();
        var stack = new Stack<Guid>();
        stack.Push(root.Id);

        while (stack.Count > 0)
        {
            var id = stack.Pop();
            if (!result.Add(id))
            {
                continue;
            }

            foreach (var child in childrenByParent[id])
            {
                stack.Push(child.Id);
            }
        }

        return result;
    }

    private static List<CategoryNode> BuildTree(ILookup<Guid?, CategoryRow> childrenByParent, Guid? parentId) =>
        childrenByParent[parentId]
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new CategoryNode(c.Id, c.Name, c.Slug, BuildTree(childrenByParent, c.Id)))
            .ToList();
}
