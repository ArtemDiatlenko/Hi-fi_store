namespace HiFiStore.Infrastructure.Catalog.Admin;

/// <summary>Управление разделами каталога и их характеристиками в админке.</summary>
public interface IAdminCategoryService
{
    /// <summary>Плоский список разделов в порядке обхода дерева (родитель, затем его подразделы).</summary>
    Task<IReadOnlyList<AdminCategoryDto>> ListAsync(CancellationToken ct = default);

    Task<AdminResult<AdminCategoryDetails>> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>Ошибки: валидация, в том числе несуществующий родитель (400), занятый slug (409).</summary>
    Task<AdminResult<AdminCategoryDetails>> CreateAsync(CategoryRequest request, CancellationToken ct = default);

    /// <summary>
    /// Изменяет раздел, в том числе переносит его под другой родительский раздел.
    /// Ошибки: нет раздела (404); валидация, в том числе перенос в самого себя или в свой подраздел (400);
    /// занятый slug или перенос, после которого ключи характеристик в ветке повторяются либо у товаров остаются
    /// значения характеристик прежних родителей (409).
    /// </summary>
    Task<AdminResult<AdminCategoryDetails>> UpdateAsync(Guid id, CategoryRequest request, CancellationToken ct = default);

    /// <summary>Раздел с подразделами или товарами не удаляется (409). Характеристики раздела удаляются вместе с ним.</summary>
    Task<AdminResult> DeleteAsync(Guid id, CancellationToken ct = default);

    Task<AdminResult<AdminSpecDefinitionDto>> GetSpecAsync(Guid categoryId, Guid specId, CancellationToken ct = default);

    /// <summary>
    /// Добавляет характеристику разделу. Ключ должен быть уникален в ветке каталога — среди самого раздела,
    /// его предков и потомков (409), чтобы значения товара однозначно задавались по ключу.
    /// </summary>
    Task<AdminResult<AdminSpecDefinitionDto>> AddSpecAsync(
        Guid categoryId, SpecDefinitionRequest request, CancellationToken ct = default);

    /// <summary>Тип значения нельзя изменить, если у товаров уже есть значения этой характеристики (409).</summary>
    Task<AdminResult<AdminSpecDefinitionDto>> UpdateSpecAsync(
        Guid categoryId, Guid specId, SpecDefinitionRequest request, CancellationToken ct = default);

    /// <summary>Удаляет характеристику вместе со значениями у товаров.</summary>
    Task<AdminResult> DeleteSpecAsync(Guid categoryId, Guid specId, CancellationToken ct = default);
}
