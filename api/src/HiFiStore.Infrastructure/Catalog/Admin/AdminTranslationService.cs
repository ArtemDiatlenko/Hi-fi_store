using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Persistence;
using HiFiStore.Infrastructure.Translation;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Catalog.Admin;

/// <summary>Текстовая характеристика товара: основное значение и его перевод.</summary>
public sealed record SpecValueTranslationDto(string Key, string SpecName, string BaseValue, string? Value);

/// <summary>
/// Перевод товара: основной текст (для сверки) рядом с переведённым. Пустые поля — перевода нет.
/// <paramref name="MachineTranslation"/> — доступен ли автоперевод (черновик через <c>.../draft</c>).
/// </summary>
public sealed record ProductTranslationDto(
    string Locale,
    string BaseName,
    string? BaseShortDescription,
    string BaseDescription,
    string? Name,
    string? ShortDescription,
    string? Description,
    IReadOnlyList<SpecValueTranslationDto> Specs,
    bool MachineTranslation);

/// <param name="Specs">Ключ текстовой характеристики → перевод значения; пусто — удалить перевод.</param>
public sealed record ProductTranslationRequest(
    string? Name,
    string? ShortDescription,
    string? Description,
    IReadOnlyDictionary<string, string?>? Specs);

public sealed record SpecDefinitionTranslationDto(Guid Id, string Key, string BaseName, string? BaseUnit, string? Name, string? Unit);

public sealed record CategoryTranslationDto(
    string Locale,
    string BaseName,
    string? BaseDescription,
    string? Name,
    string? Description,
    IReadOnlyList<SpecDefinitionTranslationDto> Specs,
    bool MachineTranslation);

public sealed record SpecDefinitionTranslationRequest(string? Name, string? Unit);

/// <param name="Specs">Ключ собственной характеристики раздела → перевод названия и единицы.</param>
public sealed record CategoryTranslationRequest(
    string? Name,
    string? Description,
    IReadOnlyDictionary<string, SpecDefinitionTranslationRequest?>? Specs);

/// <summary>
/// Переводы контента каталога в админке. Основной язык (<see cref="ContentLocales.Base"/>) редактируется в самих
/// товарах и разделах, здесь — только переводы. Пустое название удаляет перевод целиком.
/// </summary>
/// <summary>Машинный черновик перевода товара: те же поля, что в <see cref="ProductTranslationRequest"/>. Не сохраняется.</summary>
public sealed record ProductTranslationDraft(
    string Name,
    string? ShortDescription,
    string? Description,
    IReadOnlyDictionary<string, string> Specs);

/// <summary>Машинный черновик перевода раздела: те же поля, что в <see cref="CategoryTranslationRequest"/>. Не сохраняется.</summary>
public sealed record CategoryTranslationDraft(
    string Name,
    string? Description,
    IReadOnlyDictionary<string, SpecDefinitionTranslationRequest> Specs);

public sealed class AdminTranslationService(StoreDbContext db, TimeProvider time, IMachineTranslator translator)
{
    private const int NameMaxLength = 300;
    private const int CategoryNameMaxLength = 200;
    private const int ShortDescriptionMaxLength = 500;
    private const int DescriptionMaxLength = 20000;
    private const int SpecValueMaxLength = 500;
    private const int SpecNameMaxLength = 200;
    private const int UnitMaxLength = 32;

    private static AdminError UnknownLocale(string locale) =>
        AdminError.NotFound($"Язык «{locale}» не поддерживается. Доступны: {string.Join(", ", ContentLocales.Translated)}.");

    public async Task<AdminResult<ProductTranslationDto>> GetProductAsync(Guid productId, string locale, CancellationToken ct = default)
    {
        if (!ContentLocales.IsTranslated(locale))
        {
            return UnknownLocale(locale);
        }

        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == productId)
            .Select(p => new
            {
                p.Name,
                p.ShortDescription,
                p.Description,
                Translation = p.Translations.FirstOrDefault(t => t.Locale == locale),
            })
            .FirstOrDefaultAsync(ct);
        if (product is null)
        {
            return AdminError.NotFound("Товар не найден.");
        }

        var specs = await db.ProductSpecs.AsNoTracking()
            .Where(s => s.ProductId == productId && s.SpecDefinition.ValueType == SpecValueType.Text && s.TextValue != null)
            .OrderBy(s => s.SpecDefinition.SortOrder)
            .Select(s => new SpecValueTranslationDto(
                s.SpecDefinition.Key,
                s.SpecDefinition.Name,
                s.TextValue!,
                s.Translations.Where(t => t.Locale == locale).Select(t => t.TextValue).FirstOrDefault()))
            .ToListAsync(ct);

        return new ProductTranslationDto(
            locale,
            product.Name,
            product.ShortDescription,
            product.Description,
            product.Translation?.Name,
            product.Translation?.ShortDescription,
            product.Translation?.Description,
            specs,
            translator.IsEnabled);
    }

    public async Task<AdminResult<ProductTranslationDto>> SetProductAsync(
        Guid productId, string locale, ProductTranslationRequest request, CancellationToken ct = default)
    {
        if (!ContentLocales.IsTranslated(locale))
        {
            return UnknownLocale(locale);
        }

        var product = await db.Products
            .Include(p => p.Translations)
            .Include(p => p.Specs).ThenInclude(s => s.SpecDefinition)
            .Include(p => p.Specs).ThenInclude(s => s.Translations)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product is null)
        {
            return AdminError.NotFound("Товар не найден.");
        }

        var errors = new ValidationErrors();
        var name = errors.Optional("name", request.Name, NameMaxLength);
        var shortDescription = errors.Optional("shortDescription", request.ShortDescription, ShortDescriptionMaxLength);
        var description = errors.Optional("description", request.Description, DescriptionMaxLength);
        if (name is null && (shortDescription is not null || description is not null))
        {
            errors.Add("name", "Укажите название — без него перевод не сохранится.");
        }

        var textSpecs = product.Specs
            .Where(s => s.SpecDefinition.ValueType == SpecValueType.Text && s.TextValue is not null)
            .ToDictionary(s => s.SpecDefinition.Key, StringComparer.Ordinal);
        var specValues = new Dictionary<ProductSpec, string?>();
        foreach (var (key, value) in request.Specs ?? new Dictionary<string, string?>())
        {
            var field = $"specs.{key}";
            if (!textSpecs.TryGetValue(key, out var spec))
            {
                errors.Add(field, "У товара нет текстовой характеристики с таким ключом.");
                continue;
            }

            specValues[spec] = errors.Optional(field, value, SpecValueMaxLength);
        }

        if (errors.HasErrors)
        {
            return errors.ToError();
        }

        var existing = product.Translations.FirstOrDefault(t => t.Locale == locale);
        if (name is null)
        {
            if (existing is not null)
            {
                product.Translations.Remove(existing);
            }
        }
        else if (existing is null)
        {
            product.Translations.Add(new ProductTranslation
            {
                ProductId = product.Id,
                Locale = locale,
                Name = name,
                ShortDescription = shortDescription,
                Description = description,
            });
        }
        else
        {
            existing.Name = name;
            existing.ShortDescription = shortDescription;
            existing.Description = description;
        }

        foreach (var (spec, value) in specValues)
        {
            var translation = spec.Translations.FirstOrDefault(t => t.Locale == locale);
            if (value is null)
            {
                if (translation is not null)
                {
                    spec.Translations.Remove(translation);
                }
            }
            else if (translation is null)
            {
                spec.Translations.Add(new ProductSpecTranslation
                {
                    ProductId = spec.ProductId,
                    SpecDefinitionId = spec.SpecDefinitionId,
                    Locale = locale,
                    TextValue = value,
                });
            }
            else
            {
                translation.TextValue = value;
            }
        }

        product.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return await GetProductAsync(productId, locale, ct);
    }

    public async Task<AdminResult<CategoryTranslationDto>> GetCategoryAsync(Guid categoryId, string locale, CancellationToken ct = default)
    {
        if (!ContentLocales.IsTranslated(locale))
        {
            return UnknownLocale(locale);
        }

        var category = await db.Categories.AsNoTracking()
            .Where(c => c.Id == categoryId)
            .Select(c => new
            {
                c.Name,
                c.Description,
                Translation = c.Translations.FirstOrDefault(t => t.Locale == locale),
                Specs = c.Specs
                    .OrderBy(d => d.SortOrder)
                    .Select(d => new SpecDefinitionTranslationDto(
                        d.Id,
                        d.Key,
                        d.Name,
                        d.Unit,
                        d.Translations.Where(t => t.Locale == locale).Select(t => t.Name).FirstOrDefault(),
                        d.Translations.Where(t => t.Locale == locale).Select(t => t.Unit).FirstOrDefault()))
                    .ToList(),
            })
            .FirstOrDefaultAsync(ct);
        if (category is null)
        {
            return AdminError.NotFound("Раздел не найден.");
        }

        return new CategoryTranslationDto(
            locale,
            category.Name,
            category.Description,
            category.Translation?.Name,
            category.Translation?.Description,
            category.Specs,
            translator.IsEnabled);
    }

    public async Task<AdminResult<CategoryTranslationDto>> SetCategoryAsync(
        Guid categoryId, string locale, CategoryTranslationRequest request, CancellationToken ct = default)
    {
        if (!ContentLocales.IsTranslated(locale))
        {
            return UnknownLocale(locale);
        }

        var category = await db.Categories
            .Include(c => c.Translations)
            .Include(c => c.Specs).ThenInclude(d => d.Translations)
            .FirstOrDefaultAsync(c => c.Id == categoryId, ct);
        if (category is null)
        {
            return AdminError.NotFound("Раздел не найден.");
        }

        var errors = new ValidationErrors();
        var name = errors.Optional("name", request.Name, CategoryNameMaxLength);
        var description = errors.Optional("description", request.Description, DescriptionMaxLength);
        if (name is null && description is not null)
        {
            errors.Add("name", "Укажите название — без него перевод не сохранится.");
        }

        var specsByKey = category.Specs.ToDictionary(d => d.Key, StringComparer.Ordinal);
        var specValues = new Dictionary<SpecDefinition, (string? Name, string? Unit)>();
        foreach (var (key, value) in request.Specs ?? new Dictionary<string, SpecDefinitionTranslationRequest?>())
        {
            if (!specsByKey.TryGetValue(key, out var definition))
            {
                errors.Add($"specs.{key}", "У раздела нет характеристики с таким ключом.");
                continue;
            }

            var specName = errors.Optional($"specs.{key}.name", value?.Name, SpecNameMaxLength);
            var unit = errors.Optional($"specs.{key}.unit", value?.Unit, UnitMaxLength);
            if (specName is null && unit is not null)
            {
                errors.Add($"specs.{key}.name", "Укажите название характеристики.");
            }

            specValues[definition] = (specName, unit);
        }

        if (errors.HasErrors)
        {
            return errors.ToError();
        }

        var existing = category.Translations.FirstOrDefault(t => t.Locale == locale);
        if (name is null)
        {
            if (existing is not null)
            {
                category.Translations.Remove(existing);
            }
        }
        else if (existing is null)
        {
            category.Translations.Add(new CategoryTranslation { CategoryId = category.Id, Locale = locale, Name = name, Description = description });
        }
        else
        {
            existing.Name = name;
            existing.Description = description;
        }

        foreach (var (definition, (specName, unit)) in specValues)
        {
            var translation = definition.Translations.FirstOrDefault(t => t.Locale == locale);
            if (specName is null)
            {
                if (translation is not null)
                {
                    definition.Translations.Remove(translation);
                }
            }
            else if (translation is null)
            {
                definition.Translations.Add(new SpecDefinitionTranslation
                {
                    SpecDefinitionId = definition.Id,
                    Locale = locale,
                    Name = specName,
                    Unit = unit,
                });
            }
            else
            {
                translation.Name = specName;
                translation.Unit = unit;
            }
        }

        await db.SaveChangesAsync(ct);
        return await GetCategoryAsync(categoryId, locale, ct);
    }

    /// <summary>
    /// Машинный перевод основного текста товара. Возвращает черновик для формы, ничего не сохраняет:
    /// администратор проверяет его и сохраняет обычным PUT.
    /// </summary>
    public async Task<AdminResult<ProductTranslationDraft>> DraftProductAsync(Guid productId, string locale, CancellationToken ct = default)
    {
        var current = await GetProductAsync(productId, locale, ct);
        if (current.Error is not null)
        {
            return current.Error;
        }

        if (!translator.IsEnabled)
        {
            return MachineTranslationOff;
        }

        var product = current.Value!;
        var texts = new Dictionary<string, string>(StringComparer.Ordinal) { ["name"] = product.BaseName };
        AddIfPresent(texts, "shortDescription", product.BaseShortDescription);
        AddIfPresent(texts, "description", product.BaseDescription);
        foreach (var spec in product.Specs)
        {
            AddIfPresent(texts, $"spec:{spec.Key}", spec.BaseValue);
        }

        var result = await translator.TranslateAsync(texts, ContentLocales.Base, locale, $"product page of «{product.BaseName}»", ct);
        if (result.Texts is not { } translated)
        {
            return AdminError.Unavailable(result.Error!);
        }

        return new ProductTranslationDraft(
            translated["name"],
            translated.GetValueOrDefault("shortDescription"),
            translated.GetValueOrDefault("description"),
            product.Specs
                .Where(spec => translated.ContainsKey($"spec:{spec.Key}"))
                .ToDictionary(spec => spec.Key, spec => translated[$"spec:{spec.Key}"], StringComparer.Ordinal));
    }

    /// <summary>Машинный перевод основного текста раздела и его характеристик. Ничего не сохраняет.</summary>
    public async Task<AdminResult<CategoryTranslationDraft>> DraftCategoryAsync(Guid categoryId, string locale, CancellationToken ct = default)
    {
        var current = await GetCategoryAsync(categoryId, locale, ct);
        if (current.Error is not null)
        {
            return current.Error;
        }

        if (!translator.IsEnabled)
        {
            return MachineTranslationOff;
        }

        var category = current.Value!;
        var texts = new Dictionary<string, string>(StringComparer.Ordinal) { ["name"] = category.BaseName };
        AddIfPresent(texts, "description", category.BaseDescription);
        foreach (var spec in category.Specs)
        {
            AddIfPresent(texts, $"specName:{spec.Key}", spec.BaseName);
            AddIfPresent(texts, $"specUnit:{spec.Key}", spec.BaseUnit);
        }

        var result = await translator.TranslateAsync(
            texts, ContentLocales.Base, locale, $"catalog section «{category.BaseName}» with its specification names and units", ct);
        if (result.Texts is not { } translated)
        {
            return AdminError.Unavailable(result.Error!);
        }

        return new CategoryTranslationDraft(
            translated["name"],
            translated.GetValueOrDefault("description"),
            category.Specs.ToDictionary(
                spec => spec.Key,
                spec => new SpecDefinitionTranslationRequest(
                    translated.GetValueOrDefault($"specName:{spec.Key}"),
                    translated.GetValueOrDefault($"specUnit:{spec.Key}")),
                StringComparer.Ordinal));
    }

    private static AdminError MachineTranslationOff =>
        AdminError.Unavailable("Автоперевод не настроен: задайте Translation:Provider и ключ сервиса перевода.");

    private static void AddIfPresent(Dictionary<string, string> texts, string key, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            texts[key] = value.Trim();
        }
    }
}
