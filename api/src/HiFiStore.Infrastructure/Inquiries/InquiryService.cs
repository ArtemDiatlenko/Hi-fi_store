using HiFiStore.Domain.Inquiries;
using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Orders;
using HiFiStore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Inquiries;

public interface IInquiryService
{
    /// <summary>Сохраняет заявку. Товар по slug ищется среди опубликованных; не найден — заявка без товара.</summary>
    Task<AdminInquiryDetails> CreateAsync(ValidatedInquiry inquiry, Guid? userId, CancellationToken ct = default);

    /// <summary>Заявки, новые сверху. <c>Search</c> — номер, имя, телефон, email или текст.</summary>
    Task<PagedResult<AdminInquirySummary>> ListAsync(AdminInquiryFilter filter, CancellationToken ct = default);

    Task<AdminInquiryDetails?> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>Меняет статус и/или заметку. <c>null</c> — заявки нет.</summary>
    Task<AdminInquiryDetails?> UpdateAsync(Guid id, InquiryStatus? status, string? adminNote, CancellationToken ct = default);
}

public sealed class InquiryService(StoreDbContext db, TimeProvider time) : IInquiryService
{
    public const int MaxAdminNoteLength = 3000;
    private const int PreviewLength = 140;

    public async Task<AdminInquiryDetails> CreateAsync(ValidatedInquiry inquiry, Guid? userId, CancellationToken ct = default)
    {
        var product = inquiry.ProductSlug is null
            ? null
            : await db.Products.AsNoTracking()
                .Where(p => p.Slug == inquiry.ProductSlug && p.IsPublished)
                .Select(p => new { p.Id, p.Name, p.Slug })
                .SingleOrDefaultAsync(ct);

        var now = time.GetUtcNow();
        var entity = new Inquiry
        {
            Id = Guid.NewGuid(),
            Topic = inquiry.Topic,
            Name = inquiry.Name,
            Phone = inquiry.Phone,
            Email = inquiry.Email,
            PreferredContact = inquiry.PreferredContact,
            Message = inquiry.Message,
            Budget = inquiry.Budget,
            ProductId = product?.Id,
            ProductName = product?.Name,
            ProductSlug = product?.Slug,
            UserId = userId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.Inquiries.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToDetails(entity);
    }

    public async Task<PagedResult<AdminInquirySummary>> ListAsync(AdminInquiryFilter filter, CancellationToken ct = default)
    {
        IQueryable<Inquiry> query = db.Inquiries.AsNoTracking();
        if (filter.Status is { } status)
        {
            query = query.Where(i => i.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            var pattern = $"%{term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            long? number = long.TryParse(term.TrimStart('#', '№').Trim(), out var parsed) ? parsed : null;
            // Как в заказах: «067 123…» и «+380 67…» находят один номер.
            var phoneDigits = Phones.SearchDigits(term);
            var digits = phoneDigits.Length > 0 && term.All(c => char.IsAsciiDigit(c) || c is ' ' or '+' or '-' or '(' or ')' or '.')
                ? phoneDigits
                : null;
            query = query.Where(i =>
                (number != null && i.Number == number) ||
                (digits != null && i.Phone != null && i.Phone.Contains(digits)) ||
                EF.Functions.ILike(i.Name, pattern, "\\") ||
                (i.Email != null && EF.Functions.ILike(i.Email, pattern, "\\")) ||
                EF.Functions.ILike(i.Message, pattern, "\\"));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(i => i.CreatedAt)
            .ThenByDescending(i => i.Number)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(i => new AdminInquirySummary(
                i.Id, i.Number, i.Topic, i.Status, i.Name, i.Phone, i.Email, i.PreferredContact,
                i.Message.Length > PreviewLength ? i.Message.Substring(0, PreviewLength) + "…" : i.Message,
                i.ProductName, i.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<AdminInquirySummary>(items, filter.Page, filter.PageSize, total);
    }

    public async Task<AdminInquiryDetails?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var inquiry = await db.Inquiries.AsNoTracking().SingleOrDefaultAsync(i => i.Id == id, ct);
        return inquiry is null ? null : ToDetails(inquiry);
    }

    public async Task<AdminInquiryDetails?> UpdateAsync(Guid id, InquiryStatus? status, string? adminNote, CancellationToken ct = default)
    {
        var inquiry = await db.Inquiries.SingleOrDefaultAsync(i => i.Id == id, ct);
        if (inquiry is null)
        {
            return null;
        }

        if (status is { } newStatus)
        {
            inquiry.Status = newStatus;
        }

        if (adminNote is not null)
        {
            var note = adminNote.Trim();
            inquiry.AdminNote = note.Length == 0 ? null : note;
        }

        inquiry.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return ToDetails(inquiry);
    }

    private static AdminInquiryDetails ToDetails(Inquiry i) => new(
        i.Id, i.Number, i.Topic, i.Status, i.Name, i.Phone, i.Email, i.PreferredContact, i.Message, i.Budget,
        i.ProductId, i.ProductName, i.ProductSlug, i.UserId, i.AdminNote, i.CreatedAt, i.UpdatedAt);
}
