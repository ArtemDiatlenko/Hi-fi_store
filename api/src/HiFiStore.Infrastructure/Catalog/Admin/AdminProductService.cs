using System.Globalization;
using System.Text.Json;
using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Catalog.Admin;

public sealed class AdminProductService(StoreDbContext db, TimeProvider time) : IAdminProductService
{
    // Совпадают с ограничениями в ProductConfiguration, ProductImageConfiguration и ProductSpecConfiguration.
    private const int SkuMaxLength = 64;
    private const int NameMaxLength = 300;
    private const int SlugMaxLength = 300;
    private const int ShortDescriptionMaxLength = 500;
    private const int ImageUrlMaxLength = 1000;
    private const int ImageAltMaxLength = 300;
    private const int SpecTextMaxLength = 500;
    private const int MaxImages = 20;

    // numeric(12,2) и numeric(14,4): по 10 знаков до запятой.
    private const decimal MaxPrice = 9_999_999_999.99m;
    private const decimal MaxSpecNumber = 9_999_999_999.9999m;

    private static readonly AdminError NotFound = AdminError.NotFound("Товар не найден.");

    private readonly record struct SpecValue(string? Text, decimal? Number, bool? Flag);

    public async Task<PagedResult<AdminProductListItem>> ListAsync(AdminProductQuery query, CancellationToken ct = default)
    {
        IQueryable<Product> products = db.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            products = products.Where(p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term));
        }

        if (query.CategoryId is { } categoryId)
        {
            var scope = (await CategoryHierarchy.LoadAsync(db, ct)).SelfAndDescendants(categoryId);
            products = products.Where(p => scope.Contains(p.CategoryId));
        }

        if (query.BrandId is { } brandId)
        {
            products = products.Where(p => p.BrandId == brandId);
        }

        if (query.IsPublished is { } published)
        {
            products = products.Where(p => p.IsPublished == published);
        }

        var total = await products.CountAsync(ct);
        var items = await products
            .OrderByDescending(p => p.UpdatedAt)
            .ThenBy(p => p.Id)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(p => new AdminProductListItem(
                p.Id,
                p.Sku,
                p.Name,
                p.Slug,
                p.Price,
                p.OldPrice,
                p.Stock,
                p.Condition,
                p.IsPublished,
                new AdminRef(p.Brand.Id, p.Brand.Name, p.Brand.Slug),
                new AdminRef(p.Category.Id, p.Category.Name, p.Category.Slug),
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.UpdatedAt))
            .ToListAsync(ct);

        return new PagedResult<AdminProductListItem>(items, query.Page, query.PageSize, total);
    }

    public async Task<AdminResult<AdminProductDetails>> GetAsync(Guid id, CancellationToken ct = default)
    {
        var details = await LoadDetailsAsync(id, ct);
        return details is null ? NotFound : details;
    }

    public Task<AdminResult<AdminProductDetails>> CreateAsync(ProductRequest request, CancellationToken ct = default) =>
        SaveAsync(null, request, ct);

    public Task<AdminResult<AdminProductDetails>> UpdateAsync(Guid id, ProductRequest request, CancellationToken ct = default) =>
        SaveAsync(id, request, ct);

    public async Task<AdminResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null)
        {
            return NotFound;
        }

        db.Products.Remove(product);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (DbErrors.IsForeignKeyViolation(ex))
        {
            // Позиции заказов сюда не относятся: у них нет внешнего ключа на товар (см. OrderItemConfiguration).
            return AdminError.Conflict(
                $"Нельзя удалить товар «{product.Name}»: на него ссылаются другие записи. Снимите товар с публикации.");
        }

        return AdminResult.Success;
    }

    public async Task<AdminResult<AdminProductDetails>> SetSpecsAsync(
        Guid id, SetProductSpecsRequest request, CancellationToken ct = default)
    {
        var product = await db.Products
            .Include(p => p.Specs)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null)
        {
            return NotFound;
        }

        if (request.Specs is null)
        {
            return AdminError.Validation("specs", "Передайте объект specs: ключ характеристики → значение.");
        }

        var hierarchy = await CategoryHierarchy.LoadAsync(db, ct);
        var chain = hierarchy.SelfAndAncestors(product.CategoryId);
        var definitions = await db.SpecDefinitions.AsNoTracking()
            .Where(d => chain.Contains(d.CategoryId))
            .ToListAsync(ct);

        // Ключи в ветке уникальны (это проверяется при добавлении характеристик), но если повтор всё же есть,
        // берётся ближайший к товару раздел.
        var definitionsByKey = definitions
            .OrderBy(d => chain.IndexOf(d.CategoryId))
            .GroupBy(d => d.Key, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        var errors = new ValidationErrors();
        var values = new Dictionary<Guid, SpecValue>();
        foreach (var (key, element) in request.Specs)
        {
            var field = $"specs.{key}";
            if (!definitionsByKey.TryGetValue(key, out var definition))
            {
                errors.Add(field,
                    $"Характеристика «{key}» не относится к разделу «{hierarchy.NameOf(product.CategoryId)}» " +
                    "и его родительским разделам.");
                continue;
            }

            if (element.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            {
                continue;
            }

            if (TryParseSpecValue(definition.ValueType, element, out var value, out var error))
            {
                values[definition.Id] = value;
            }
            else
            {
                errors.Add(field, error);
            }
        }

        if (errors.HasErrors)
        {
            return errors.ToError();
        }

        foreach (var spec in product.Specs.Where(s => !values.ContainsKey(s.SpecDefinitionId)).ToList())
        {
            db.ProductSpecs.Remove(spec);
        }

        foreach (var (definitionId, value) in values)
        {
            var spec = product.Specs.FirstOrDefault(s => s.SpecDefinitionId == definitionId);
            if (spec is null)
            {
                spec = new ProductSpec { ProductId = product.Id, SpecDefinitionId = definitionId };
                db.ProductSpecs.Add(spec);
            }

            spec.TextValue = value.Text;
            spec.NumberValue = value.Number;
            spec.BoolValue = value.Flag;
        }

        product.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return await GetAsync(product.Id, ct);
    }

    public async Task<AdminResult<AdminProductDetails>> SetImagesAsync(
        Guid id, SetProductImagesRequest request, CancellationToken ct = default)
    {
        var product = await db.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null)
        {
            return NotFound;
        }

        if (request.Images is null)
        {
            return AdminError.Validation("images", "Передайте список изображений; пустой список удаляет все изображения.");
        }

        var errors = new ValidationErrors();
        if (request.Images.Count > MaxImages)
        {
            errors.Add("images", $"Не больше {MaxImages} изображений.");
        }

        var images = new List<ProductImage>(request.Images.Count);
        for (var index = 0; index < request.Images.Count; index++)
        {
            var item = request.Images[index];
            var field = $"images[{index}]";
            if (item is null)
            {
                errors.Add(field, "Укажите адрес и описание изображения.");
                continue;
            }

            var url = errors.Required($"{field}.url", item.Url, ImageUrlMaxLength, "Укажите адрес изображения.");
            if (url.Length is > 0 and <= ImageUrlMaxLength && !IsValidImageUrl(url))
            {
                errors.Add($"{field}.url", "Ожидается адрес http(s) или путь от корня сайта, например /images/amp.png.");
            }

            var alt = errors.Optional($"{field}.alt", item.Alt, ImageAltMaxLength);
            images.Add(new ProductImage { Id = Guid.NewGuid(), ProductId = product.Id, Url = url, Alt = alt, SortOrder = index });
        }

        if (errors.HasErrors)
        {
            return errors.ToError();
        }

        db.ProductImages.RemoveRange(product.Images);
        db.ProductImages.AddRange(images);
        product.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return await GetAsync(product.Id, ct);
    }

    public async Task<AdminResult<AdminProductDetails>> SetPublishedAsync(Guid id, bool published, CancellationToken ct = default)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null)
        {
            return NotFound;
        }

        if (product.IsPublished != published)
        {
            product.IsPublished = published;
            product.UpdatedAt = time.GetUtcNow();
            await db.SaveChangesAsync(ct);
        }

        return await GetAsync(product.Id, ct);
    }

    private async Task<AdminResult<AdminProductDetails>> SaveAsync(Guid? id, ProductRequest request, CancellationToken ct)
    {
        Product? product = null;
        if (id is not null)
        {
            product = await db.Products
                .Include(p => p.Specs)
                .ThenInclude(s => s.SpecDefinition)
                .FirstOrDefaultAsync(p => p.Id == id, ct);
            if (product is null)
            {
                return NotFound;
            }
        }

        var errors = new ValidationErrors();
        var sku = errors.Required("sku", request.Sku, SkuMaxLength, "Укажите артикул.");
        var name = errors.Required("name", request.Name, NameMaxLength, "Укажите название товара.");
        var slug = errors.ResolveSlug(request.Slug, name, product?.Slug, SlugMaxLength);
        var shortDescription = errors.Optional("shortDescription", request.ShortDescription, ShortDescriptionMaxLength);
        ValidatePrices(errors, request.Price, request.OldPrice);

        var stock = request.Stock ?? 0;
        if (stock < 0)
        {
            errors.Add("stock", "Остаток не может быть отрицательным.");
        }

        var condition = request.Condition ?? ProductCondition.New;
        if (!Enum.IsDefined(condition))
        {
            errors.Add("condition", "Допустимые значения: New, Used, Demo.");
        }

        if (request.CategoryId is not { } categoryId)
        {
            errors.Add("categoryId", "Укажите раздел.");
            categoryId = Guid.Empty;
        }
        else if (!await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
        {
            errors.Add("categoryId", "Раздел не найден.");
        }

        if (request.BrandId is not { } brandId)
        {
            errors.Add("brandId", "Укажите бренд.");
            brandId = Guid.Empty;
        }
        else if (!await db.Brands.AnyAsync(b => b.Id == brandId, ct))
        {
            errors.Add("brandId", "Бренд не найден.");
        }

        if (errors.HasErrors)
        {
            return errors.ToError();
        }

        if (await db.Products.AnyAsync(p => p.Sku == sku && p.Id != id, ct))
        {
            return AdminError.Conflict($"Товар с артикулом «{sku}» уже существует.");
        }

        if (await db.Products.AnyAsync(p => p.Slug == slug && p.Id != id, ct))
        {
            return AdminError.Conflict($"Товар со slug «{slug}» уже существует. Укажите другой slug.");
        }

        var now = time.GetUtcNow();
        if (product is null)
        {
            product = new Product { Id = Guid.NewGuid(), Sku = sku, Name = name, Slug = slug, CreatedAt = now };
            db.Products.Add(product);
        }
        else if (product.CategoryId != categoryId)
        {
            // Характеристики прежнего раздела к новому не относятся.
            var chain = (await CategoryHierarchy.LoadAsync(db, ct)).SelfAndAncestors(categoryId);
            foreach (var spec in product.Specs.Where(s => !chain.Contains(s.SpecDefinition.CategoryId)).ToList())
            {
                db.ProductSpecs.Remove(spec);
            }
        }

        product.Sku = sku;
        product.Name = name;
        product.Slug = slug;
        product.ShortDescription = shortDescription;
        product.Description = request.Description?.Trim() ?? string.Empty;
        product.Price = request.Price!.Value;
        product.OldPrice = request.OldPrice;
        product.Stock = stock;
        product.Condition = condition;
        product.CategoryId = categoryId;
        product.BrandId = brandId;
        product.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            return AdminError.Conflict("Товар с таким артикулом или slug уже существует.");
        }

        return await GetAsync(product.Id, ct);
    }

    private static void ValidatePrices(ValidationErrors errors, decimal? price, decimal? oldPrice)
    {
        var priceValid = false;
        if (price is null)
        {
            errors.Add("price", "Укажите цену.");
        }
        else if (price < 0)
        {
            errors.Add("price", "Цена не может быть отрицательной.");
        }
        else if (price > MaxPrice)
        {
            errors.Add("price", "Слишком большая цена.");
        }
        else
        {
            priceValid = true;
        }

        if (oldPrice is null)
        {
            return;
        }

        if (oldPrice < 0)
        {
            errors.Add("oldPrice", "Старая цена не может быть отрицательной.");
        }
        else if (oldPrice > MaxPrice)
        {
            errors.Add("oldPrice", "Слишком большая цена.");
        }
        else if (priceValid && oldPrice <= price)
        {
            errors.Add("oldPrice", "Старая цена должна быть больше текущей. Если скидки нет, оставьте поле пустым.");
        }
    }

    private static bool TryParseSpecValue(SpecValueType type, JsonElement element, out SpecValue value, out string error)
    {
        value = default;
        error = string.Empty;

        switch (type)
        {
            case SpecValueType.Number:
                if (!TryReadNumber(element, out var number))
                {
                    error = "Ожидается число.";
                    return false;
                }

                if (Math.Abs(number) > MaxSpecNumber)
                {
                    error = "Слишком большое число.";
                    return false;
                }

                value = new SpecValue(null, number, null);
                return true;

            case SpecValueType.Boolean:
                bool? flag = element.ValueKind switch
                {
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.String when bool.TryParse(element.GetString(), out var b) => b,
                    _ => null,
                };

                if (flag is null)
                {
                    error = "Ожидается true или false.";
                    return false;
                }

                value = new SpecValue(null, null, flag);
                return true;

            default:
                var text = element.ValueKind == JsonValueKind.String ? element.GetString()?.Trim() : null;
                if (string.IsNullOrEmpty(text))
                {
                    error = "Ожидается непустая строка.";
                    return false;
                }

                if (text.Length > SpecTextMaxLength)
                {
                    error = $"Не длиннее {SpecTextMaxLength} символов.";
                    return false;
                }

                value = new SpecValue(text, null, null);
                return true;
        }
    }

    /// <summary>Число из JSON: числом или строкой в инвариантной культуре (<c>"0.5"</c>).</summary>
    private static bool TryReadNumber(JsonElement element, out decimal number)
    {
        number = 0;
        return element.ValueKind switch
        {
            JsonValueKind.Number => element.TryGetDecimal(out number),
            JsonValueKind.String => decimal.TryParse(
                element.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out number),
            _ => false,
        };
    }

    /// <summary>Абсолютный адрес http(s) или путь от корня сайта (<c>/images/a.png</c>).</summary>
    private static bool IsValidImageUrl(string url)
    {
        if (url.StartsWith('/'))
        {
            return !url.StartsWith("//") && Uri.IsWellFormedUriString(url, UriKind.Relative);
        }

        return Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https" && uri.Host.Length > 0;
    }

    private async Task<AdminProductDetails?> LoadDetailsAsync(Guid id, CancellationToken ct)
    {
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new
            {
                p.Id,
                p.Sku,
                p.Name,
                p.Slug,
                p.ShortDescription,
                p.Description,
                p.Price,
                p.OldPrice,
                p.Stock,
                p.Condition,
                p.IsPublished,
                Brand = new AdminRef(p.Brand.Id, p.Brand.Name, p.Brand.Slug),
                Category = new AdminRef(p.Category.Id, p.Category.Name, p.Category.Slug),
                p.CreatedAt,
                p.UpdatedAt,
            })
            .FirstOrDefaultAsync(ct);

        if (product is null)
        {
            return null;
        }

        var images = await db.ProductImages.AsNoTracking()
            .Where(i => i.ProductId == id)
            .OrderBy(i => i.SortOrder)
            .Select(i => new ImageDto(i.Url, i.Alt))
            .ToListAsync(ct);

        var specs = await db.ProductSpecs.AsNoTracking()
            .Where(s => s.ProductId == id)
            .OrderBy(s => s.SpecDefinition.SortOrder)
            .ThenBy(s => s.SpecDefinition.Name)
            .Select(s => new
            {
                s.SpecDefinition.Key,
                s.SpecDefinition.Name,
                s.SpecDefinition.Unit,
                s.SpecDefinition.ValueType,
                s.NumberValue,
                s.TextValue,
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

        // Доступные характеристики: сначала общие (родительских разделов), затем собственные раздела товара.
        var chain = (await CategoryHierarchy.LoadAsync(db, ct)).SelfAndAncestors(product.Category.Id);
        var available = (await db.SpecDefinitions.AsNoTracking()
                .Where(d => chain.Contains(d.CategoryId))
                .ToListAsync(ct))
            .OrderByDescending(d => chain.IndexOf(d.CategoryId))
            .ThenBy(d => d.SortOrder)
            .ThenBy(d => d.Name)
            .Select(d => new AdminSpecDefinitionDto(
                d.Id, d.CategoryId, d.Key, d.Name, d.Unit, d.ValueType, d.IsFilterable, d.SortOrder))
            .ToList();

        return new AdminProductDetails(
            product.Id,
            product.Sku,
            product.Name,
            product.Slug,
            product.ShortDescription,
            product.Description,
            product.Price,
            product.OldPrice,
            product.Stock,
            product.Condition,
            product.IsPublished,
            product.Brand,
            product.Category,
            images,
            specDtos,
            available,
            product.CreatedAt,
            product.UpdatedAt);
    }
}
