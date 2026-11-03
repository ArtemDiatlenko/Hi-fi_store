using HiFiStore.Domain.Inquiries;
using HiFiStore.Infrastructure.Catalog;
using HiFiStore.Infrastructure.Inquiries;
using HiFiStore.Infrastructure.Orders;
using Microsoft.AspNetCore.Mvc;

namespace HiFiStore.Api.Controllers.Admin;

/// <summary>Заявки на консультацию: список с фильтром по статусу и поиском, карточка, смена статуса и заметка.</summary>
[Route("api/admin/inquiries")]
public sealed class AdminInquiriesController(IInquiryService inquiries) : AdminControllerBase
{
    private const int MaxSearchLength = 200;

    /// <summary>Параметры: <c>status</c>, <c>q</c> (номер, имя, телефон, email, текст), <c>page</c>, <c>pageSize</c>.</summary>
    [HttpGet]
    [ProducesResponseType<PagedResult<AdminInquirySummary>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var (page, pageSize) = Paging.Parse(Request.Query, errors);

        InquiryStatus? status = null;
        var rawStatus = Request.Query["status"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(rawStatus))
        {
            if (EnumNames.TryParse<InquiryStatus>(rawStatus, out var parsed))
            {
                status = parsed;
            }
            else
            {
                errors["status"] = [$"Неизвестный статус. Допустимые значения: {EnumNames.List<InquiryStatus>()}."];
            }
        }

        var search = Request.Query["q"].FirstOrDefault()?.Trim();
        if (search is { Length: > MaxSearchLength })
        {
            errors["q"] = [$"Строка поиска — не больше {MaxSearchLength} символов."];
        }

        if (errors.Count > 0)
        {
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        return Ok(await inquiries.ListAsync(new AdminInquiryFilter(status, search, page, pageSize), ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<AdminInquiryDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminInquiryDetails>> Get(Guid id, CancellationToken ct)
    {
        var inquiry = await inquiries.GetAsync(id, ct);
        return inquiry is null ? NotFound() : Ok(inquiry);
    }

    /// <summary>Тело: <c>{ "status": "InProgress", "adminNote": "Перезвонить в пятницу" }</c>; поле можно не передавать.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType<AdminInquiryDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateInquiryRequest? request, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        InquiryStatus? status = null;
        if (request?.Status is not null)
        {
            if (EnumNames.TryParse<InquiryStatus>(request.Status, out var parsed))
            {
                status = parsed;
            }
            else
            {
                errors["status"] = [$"Укажите статус: {EnumNames.List<InquiryStatus>()}."];
            }
        }

        if (request?.AdminNote is { Length: > InquiryService.MaxAdminNoteLength })
        {
            errors["adminNote"] = [$"Заметка — не больше {InquiryService.MaxAdminNoteLength} символов."];
        }

        if (errors.Count > 0)
        {
            return ValidationProblem(new ValidationProblemDetails(errors));
        }

        var updated = await inquiries.UpdateAsync(id, status, request?.AdminNote, ct);
        return updated is null ? NotFound() : Ok(updated);
    }
}
