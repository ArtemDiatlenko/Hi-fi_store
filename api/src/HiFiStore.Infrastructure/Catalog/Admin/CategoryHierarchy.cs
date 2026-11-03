using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Catalog.Admin;

/// <summary>
/// Дерево разделов в памяти для проверок: предки, потомки, циклы. Разделов немного,
/// поэтому дерево загружается целиком одним запросом.
/// </summary>
internal sealed class CategoryHierarchy
{
    private readonly Dictionary<Guid, (Guid? ParentId, string Name)> _nodes;
    private readonly ILookup<Guid?, Guid> _childrenByParent;

    private CategoryHierarchy(Dictionary<Guid, (Guid? ParentId, string Name)> nodes)
    {
        _nodes = nodes;
        _childrenByParent = nodes.ToLookup(n => n.Value.ParentId, n => n.Key);
    }

    public static async Task<CategoryHierarchy> LoadAsync(StoreDbContext db, CancellationToken ct)
    {
        var rows = await db.Categories.AsNoTracking()
            .Select(c => new { c.Id, c.ParentId, c.Name })
            .ToListAsync(ct);

        return new CategoryHierarchy(rows.ToDictionary(r => r.Id, r => (r.ParentId, r.Name)));
    }

    public bool Contains(Guid id) => _nodes.ContainsKey(id);

    public string NameOf(Guid id) => _nodes.TryGetValue(id, out var node) ? node.Name : id.ToString();

    /// <summary>Раздел и его предки — от самого раздела к корню.</summary>
    public List<Guid> SelfAndAncestors(Guid id)
    {
        var result = new List<Guid>();
        Guid? current = id;

        // Проверка на повтор защищает от зацикливания, если данные в базе уже испорчены.
        while (current is { } currentId && _nodes.TryGetValue(currentId, out var node) && !result.Contains(currentId))
        {
            result.Add(currentId);
            current = node.ParentId;
        }

        return result;
    }

    /// <summary>Предки раздела — от родителя к корню.</summary>
    public List<Guid> Ancestors(Guid id) => SelfAndAncestors(id).Skip(1).ToList();

    /// <summary>Раздел и все вложенные в него разделы.</summary>
    public HashSet<Guid> SelfAndDescendants(Guid id)
    {
        var result = new HashSet<Guid>();
        var stack = new Stack<Guid>();
        stack.Push(id);

        while (stack.Count > 0)
        {
            var current = stack.Pop();
            if (!result.Add(current))
            {
                continue;
            }

            foreach (var child in _childrenByParent[current])
            {
                stack.Push(child);
            }
        }

        return result;
    }
}
