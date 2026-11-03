using HiFiStore.Domain.Orders;
using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Identity;

public sealed record AdminCustomerFilter(string? Search, int Page, int PageSize);

/// <summary>
/// Зарегистрированный пользователь для админки. Суммы — по заказам, оформленным после входа
/// (гостевые заказы к аккаунту не привязаны); отменённые заказы в сумму не входят.
/// </summary>
public sealed record AdminCustomerSummary(
    Guid Id,
    string Email,
    string? FullName,
    bool EmailConfirmed,
    bool IsAdmin,
    bool IsLockedOut,
    DateTimeOffset? RegisteredAt,
    int OrderCount,
    decimal OrdersTotal,
    DateTimeOffset? LastOrderAt);

public sealed record AdminCustomerDetails(
    Guid Id,
    string Email,
    string? FullName,
    string? PhoneNumber,
    bool EmailConfirmed,
    IReadOnlyList<string> Roles,
    bool IsLockedOut,
    DateTimeOffset? LockoutEnd,
    int AccessFailedCount,
    DateTimeOffset? RegisteredAt,
    int OrderCount,
    decimal OrdersTotal,
    DateTimeOffset? LastOrderAt);

public interface IAdminCustomerService
{
    /// <summary>Пользователи, новые сверху. <c>Search</c> — часть email или имени.</summary>
    Task<PagedResult<AdminCustomerSummary>> ListAsync(AdminCustomerFilter filter, CancellationToken ct = default);

    Task<AdminCustomerDetails?> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>Снимает блокировку входа после неудачных попыток. <c>null</c> — пользователя нет.</summary>
    Task<AdminCustomerDetails?> UnlockAsync(Guid id, CancellationToken ct = default);
}

public sealed class AdminCustomerService(StoreDbContext db, TimeProvider time) : IAdminCustomerService
{
    public async Task<PagedResult<AdminCustomerSummary>> ListAsync(AdminCustomerFilter filter, CancellationToken ct = default)
    {
        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = $"%{EscapeLike(filter.Search.Trim())}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.Email!, pattern, "\\") ||
                (u.FullName != null && EF.Functions.ILike(u.FullName, pattern, "\\")));
        }

        var now = time.GetUtcNow();
        var adminRoleId = Roles.Ids[Roles.Admin];
        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(u => u.RegisteredAt.HasValue)
            .ThenByDescending(u => u.RegisteredAt)
            .ThenBy(u => u.Email)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(u => new AdminCustomerSummary(
                u.Id,
                u.Email!,
                u.FullName,
                u.EmailConfirmed,
                db.UserRoles.Any(r => r.UserId == u.Id && r.RoleId == adminRoleId),
                u.LockoutEnd != null && u.LockoutEnd > now,
                u.RegisteredAt,
                db.Orders.Count(o => o.UserId == u.Id),
                db.Orders.Where(o => o.UserId == u.Id && o.Status != OrderStatus.Cancelled).Sum(o => (decimal?)o.Total) ?? 0,
                db.Orders.Where(o => o.UserId == u.Id).Max(o => (DateTimeOffset?)o.CreatedAt)))
            .ToListAsync(ct);

        return new PagedResult<AdminCustomerSummary>(items, filter.Page, filter.PageSize, total);
    }

    public async Task<AdminCustomerDetails?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var customer = await db.Users.AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => new
            {
                User = u,
                Roles = db.UserRoles.Where(r => r.UserId == u.Id)
                    .Join(db.Roles, ur => ur.RoleId, r => r.Id, (_, r) => r.Name!)
                    .OrderBy(name => name)
                    .ToList(),
                OrderCount = db.Orders.Count(o => o.UserId == u.Id),
                OrdersTotal = db.Orders.Where(o => o.UserId == u.Id && o.Status != OrderStatus.Cancelled).Sum(o => (decimal?)o.Total) ?? 0,
                LastOrderAt = db.Orders.Where(o => o.UserId == u.Id).Max(o => (DateTimeOffset?)o.CreatedAt),
            })
            .SingleOrDefaultAsync(ct);

        if (customer is null)
        {
            return null;
        }

        var user = customer.User;
        return new AdminCustomerDetails(
            user.Id,
            user.Email!,
            user.FullName,
            user.PhoneNumber,
            user.EmailConfirmed,
            customer.Roles,
            user.LockoutEnd is { } end && end > now,
            user.LockoutEnd,
            user.AccessFailedCount,
            user.RegisteredAt,
            customer.OrderCount,
            customer.OrdersTotal,
            customer.LastOrderAt);
    }

    public async Task<AdminCustomerDetails?> UnlockAsync(Guid id, CancellationToken ct = default)
    {
        var updated = await db.Users
            .Where(u => u.Id == id)
            .ExecuteUpdateAsync(set => set
                .SetProperty(u => u.LockoutEnd, (DateTimeOffset?)null)
                .SetProperty(u => u.AccessFailedCount, 0), ct);

        return updated == 0 ? null : await GetAsync(id, ct);
    }

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
