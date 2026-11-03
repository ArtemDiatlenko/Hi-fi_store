using System.Linq.Expressions;
using System.Text.RegularExpressions;
using HiFiStore.Domain.Catalog;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Catalog.Admin;

public sealed partial class AdminCategoryService(StoreDbContext db) : IAdminCategoryService
{
    // Совпадают с ограничениями в CategoryConfiguration и SpecDefinitionConfiguration.
    private const int NameMaxLength = 200;
    private const int SlugMaxLength = 200;
    private const int SpecNameMaxLength = 200;
    private const int SpecUnitMaxLength = 32;

    private static readonly AdminError NotFound = AdminError.NotFound("Раздел не найден.");
    private static readonly AdminError SpecNotFound = AdminError.NotFound("Характеристика не найдена.");

    private static readonly Expression<Func<SpecDefinition, AdminSpecDefinitionDto>> ToSpecDto =
        d => new AdminSpecDefinitionDto(d.Id, d.CategoryId, d.Key, d.Name, d.Unit, d.ValueType, d.IsFilterable, d.SortOrder);

    private static readonly Func<SpecDefinition, AdminSpecDefinitionDto> MapSpec = ToSpecDto.Compile();

    public async Task<IReadOnlyList<AdminCategoryDto>> ListAsync(CancellationToken ct = default)
    {
        var rows = await ProjectToDtos(db.Categories).ToListAsync(ct);

        // Обход в глубину: так список можно сразу показывать деревом с отступами.
        var childrenByParent = rows.ToLookup(r => r.ParentId);
        var result = new List<AdminCategoryDto>(rows.Count);
        AppendChildren(null);
        return result;

        void AppendChildren(Guid? parentId)
        {
            foreach (var row in childrenByParent[parentId].OrderBy(r => r.SortOrder).ThenBy(r => r.Name))
            {
                result.Add(row);
                AppendChildren(row.Id);
            }
        }
    }

    public async Task<AdminResult<AdminCategoryDetails>> GetAsync(Guid id, CancellationToken ct = default)
    {
        var category = await ProjectToDtos(db.Categories.Where(c => c.Id == id)).FirstOrDefaultAsync(ct);
        if (category is null)
        {
            return NotFound;
        }

        var specs = await db.SpecDefinitions.AsNoTracking()
            .Where(d => d.CategoryId == id)
            .OrderBy(d => d.SortOrder)
            .ThenBy(d => d.Name)
            .Select(ToSpecDto)
            .ToListAsync(ct);

        return new AdminCategoryDetails(
            category.Id,
            category.Name,
            category.Slug,
            category.Description,
            category.ParentId,
            category.SortOrder,
            category.ChildCount,
            category.ProductCount,
            specs);
    }

    public Task<AdminResult<AdminCategoryDetails>> CreateAsync(CategoryRequest request, CancellationToken ct = default) =>
        SaveAsync(null, request, ct);

    public Task<AdminResult<AdminCategoryDetails>> UpdateAsync(Guid id, CategoryRequest request, CancellationToken ct = default) =>
        SaveAsync(id, request, ct);

    public async Task<AdminResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null)
        {
            return NotFound;
        }

        var childCount = await db.Categories.CountAsync(c => c.ParentId == id, ct);
        var productCount = await db.Products.CountAsync(p => p.CategoryId == id, ct);
        if (childCount > 0 || productCount > 0)
        {
            var reasons = new List<string>();
            if (childCount > 0)
            {
                reasons.Add($"подразделы ({childCount})");
            }

            if (productCount > 0)
            {
                reasons.Add($"товары ({productCount})");
            }

            return AdminError.Conflict(
                $"Нельзя удалить раздел «{category.Name}»: в нём есть {string.Join(" и ", reasons)}. " +
                "Сначала удалите или перенесите их.");
        }

        db.Categories.Remove(category);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (DbErrors.IsForeignKeyViolation(ex))
        {
            return AdminError.Conflict($"Нельзя удалить раздел «{category.Name}»: в нём появились подразделы или товары.");
        }

        return AdminResult.Success;
    }

    public async Task<AdminResult<AdminSpecDefinitionDto>> GetSpecAsync(
        Guid categoryId, Guid specId, CancellationToken ct = default)
    {
        var spec = await db.SpecDefinitions.AsNoTracking()
            .Where(d => d.Id == specId && d.CategoryId == categoryId)
            .Select(ToSpecDto)
            .FirstOrDefaultAsync(ct);

        return spec is null ? SpecNotFound : spec;
    }

    public async Task<AdminResult<AdminSpecDefinitionDto>> AddSpecAsync(
        Guid categoryId, SpecDefinitionRequest request, CancellationToken ct = default)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
        {
            return NotFound;
        }

        var spec = new SpecDefinition { Id = Guid.NewGuid(), CategoryId = categoryId, Key = string.Empty, Name = string.Empty };
        var error = await ApplySpecAsync(spec, request, isNew: true, ct);
        if (error is not null)
        {
            return error;
        }

        db.SpecDefinitions.Add(spec);
        return await SaveSpecAsync(spec, ct);
    }

    public async Task<AdminResult<AdminSpecDefinitionDto>> UpdateSpecAsync(
        Guid categoryId, Guid specId, SpecDefinitionRequest request, CancellationToken ct = default)
    {
        var spec = await db.SpecDefinitions.FirstOrDefaultAsync(d => d.Id == specId && d.CategoryId == categoryId, ct);
        if (spec is null)
        {
            return SpecNotFound;
        }

        var error = await ApplySpecAsync(spec, request, isNew: false, ct);
        return error ?? await SaveSpecAsync(spec, ct);
    }

    public async Task<AdminResult> DeleteSpecAsync(Guid categoryId, Guid specId, CancellationToken ct = default)
    {
        var spec = await db.SpecDefinitions.FirstOrDefaultAsync(d => d.Id == specId && d.CategoryId == categoryId, ct);
        if (spec is null)
        {
            return SpecNotFound;
        }

        // Значения у товаров удаляются каскадно (см. ProductSpecConfiguration).
        db.SpecDefinitions.Remove(spec);
        await db.SaveChangesAsync(ct);
        return AdminResult.Success;
    }

    private IQueryable<AdminCategoryDto> ProjectToDtos(IQueryable<Category> categories) =>
        categories.AsNoTracking().Select(c => new AdminCategoryDto(
            c.Id,
            c.Name,
            c.Slug,
            c.Description,
            c.ParentId,
            c.SortOrder,
            c.Children.Count,
            db.Products.Count(p => p.CategoryId == c.Id)));

    private async Task<AdminResult<AdminCategoryDetails>> SaveAsync(Guid? id, CategoryRequest request, CancellationToken ct)
    {
        Category? category = null;
        if (id is not null)
        {
            category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct);
            if (category is null)
            {
                return NotFound;
            }
        }

        var hierarchy = await CategoryHierarchy.LoadAsync(db, ct);

        var errors = new ValidationErrors();
        var name = errors.Required("name", request.Name, NameMaxLength, "Укажите название раздела.");
        var slug = errors.ResolveSlug(request.Slug, name, category?.Slug, SlugMaxLength);
        var description = errors.Optional("description", request.Description, int.MaxValue);

        if (request.ParentId is { } parentId)
        {
            if (!hierarchy.Contains(parentId))
            {
                errors.Add("parentId", "Родительский раздел не найден.");
            }
            else if (category is not null && hierarchy.SelfAndAncestors(parentId).Contains(category.Id))
            {
                errors.Add("parentId", "Нельзя вложить раздел в самого себя или в собственный подраздел.");
            }
        }

        if (errors.HasErrors)
        {
            return errors.ToError();
        }

        if (await db.Categories.AnyAsync(c => c.Slug == slug && c.Id != id, ct))
        {
            return SlugTaken(slug);
        }

        if (category is not null && category.ParentId != request.ParentId)
        {
            var moveError = await CheckMoveAsync(hierarchy, category.Id, request.ParentId, ct);
            if (moveError is not null)
            {
                return moveError;
            }
        }

        if (category is null)
        {
            category = new Category { Id = Guid.NewGuid(), Name = name, Slug = slug };
            db.Categories.Add(category);
        }

        category.Name = name;
        category.Slug = slug;
        category.Description = description;
        category.ParentId = request.ParentId;
        category.SortOrder = request.SortOrder;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            return SlugTaken(slug);
        }

        return await GetAsync(category.Id, ct);
    }

    /// <summary>
    /// Перенос раздела не должен ломать характеристики товаров: в новой ветке ключи характеристик не повторяются,
    /// а у товаров перенесённых разделов нет значений характеристик, которые объявлены у прежних предков.
    /// </summary>
    private async Task<AdminError?> CheckMoveAsync(
        CategoryHierarchy hierarchy, Guid categoryId, Guid? newParentId, CancellationToken ct)
    {
        var subtree = hierarchy.SelfAndDescendants(categoryId);
        var newAncestors = newParentId is { } parentId ? hierarchy.SelfAndAncestors(parentId) : [];

        var definitions = await db.SpecDefinitions.AsNoTracking()
            .Where(d => subtree.Contains(d.CategoryId) || newAncestors.Contains(d.CategoryId))
            .Select(d => new { d.CategoryId, d.Key })
            .ToListAsync(ct);

        var subtreeKeys = definitions.Where(d => subtree.Contains(d.CategoryId)).Select(d => d.Key).ToHashSet();
        var duplicateKeys = definitions
            .Where(d => !subtree.Contains(d.CategoryId) && subtreeKeys.Contains(d.Key))
            .Select(d => d.Key)
            .Distinct()
            .Order()
            .ToList();

        if (duplicateKeys.Count > 0)
        {
            return AdminError.Conflict(
                $"Нельзя перенести раздел: характеристики с ключами {string.Join(", ", duplicateKeys)} " +
                "уже есть в новом родительском разделе или выше. Ключи в одной ветке каталога должны быть уникальны.");
        }

        var lostAncestors = hierarchy.Ancestors(categoryId).Except(newAncestors).ToList();
        if (lostAncestors.Count == 0)
        {
            return null;
        }

        var keysInUse = await db.ProductSpecs.AsNoTracking()
            .Where(s => lostAncestors.Contains(s.SpecDefinition.CategoryId) && subtree.Contains(s.Product.CategoryId))
            .Select(s => s.SpecDefinition.Key)
            .Distinct()
            .ToListAsync(ct);

        return keysInUse.Count == 0
            ? null
            : AdminError.Conflict(
                $"Нельзя перенести раздел: у его товаров заданы характеристики прежних родительских разделов " +
                $"({string.Join(", ", keysInUse.Order())}). Сначала удалите эти значения у товаров.");
    }

    /// <summary>Проверяет запрос и переносит значения в <paramref name="spec"/>; возвращает ошибку или <c>null</c>.</summary>
    private async Task<AdminError?> ApplySpecAsync(
        SpecDefinition spec, SpecDefinitionRequest request, bool isNew, CancellationToken ct)
    {
        var errors = new ValidationErrors();
        var key = request.Key?.Trim() ?? string.Empty;
        if (key.Length == 0)
        {
            errors.Add("key", "Укажите ключ характеристики.");
        }
        else if (!SpecKeyPattern().IsMatch(key))
        {
            errors.Add("key", "Ключ может содержать только строчные латинские буквы, цифры и подчёркивание (до 64 символов), например «power_w».");
        }

        var name = errors.Required("name", request.Name, SpecNameMaxLength, "Укажите название характеристики.");
        var unit = errors.Optional("unit", request.Unit, SpecUnitMaxLength);

        if (request.ValueType is not { } valueType || !Enum.IsDefined(valueType))
        {
            errors.Add("valueType", "Укажите тип значения: Text, Number или Boolean.");
            valueType = default;
        }

        if (errors.HasErrors)
        {
            return errors.ToError();
        }

        if (isNew || key != spec.Key)
        {
            var hierarchy = await CategoryHierarchy.LoadAsync(db, ct);
            var branch = hierarchy.SelfAndAncestors(spec.CategoryId)
                .Concat(hierarchy.SelfAndDescendants(spec.CategoryId))
                .ToList();

            var clash = await db.SpecDefinitions.AsNoTracking()
                .Where(d => d.Key == key && d.Id != spec.Id && branch.Contains(d.CategoryId))
                .Select(d => (Guid?)d.CategoryId)
                .FirstOrDefaultAsync(ct);

            if (clash is { } clashCategoryId)
            {
                return KeyTaken(key, hierarchy.NameOf(clashCategoryId));
            }
        }

        if (!isNew && valueType != spec.ValueType)
        {
            var valueCount = await db.ProductSpecs.CountAsync(s => s.SpecDefinitionId == spec.Id, ct);
            if (valueCount > 0)
            {
                return AdminError.Conflict(
                    $"Нельзя изменить тип характеристики «{spec.Name}»: значения уже заданы у товаров ({valueCount}). " +
                    "Сначала удалите эти значения.");
            }
        }

        spec.Key = key;
        spec.Name = name;
        spec.Unit = unit;
        spec.ValueType = valueType;
        spec.IsFilterable = request.IsFilterable;
        spec.SortOrder = request.SortOrder;
        return null;
    }

    private async Task<AdminResult<AdminSpecDefinitionDto>> SaveSpecAsync(SpecDefinition spec, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            return AdminError.Conflict($"Характеристика с ключом «{spec.Key}» уже есть в этом разделе.");
        }

        return MapSpec(spec);
    }

    private static AdminError SlugTaken(string slug) =>
        AdminError.Conflict($"Раздел со slug «{slug}» уже существует. Укажите другой slug.");

    private static AdminError KeyTaken(string key, string categoryName) =>
        AdminError.Conflict(
            $"Характеристика с ключом «{key}» уже есть в разделе «{categoryName}». " +
            "Ключи в одной ветке каталога (раздел, его предки и подразделы) должны быть уникальны.");

    [GeneratedRegex("^[a-z0-9_]{1,64}$")]
    private static partial Regex SpecKeyPattern();
}
