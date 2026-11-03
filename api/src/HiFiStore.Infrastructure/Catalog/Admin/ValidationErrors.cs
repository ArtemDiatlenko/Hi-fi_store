namespace HiFiStore.Infrastructure.Catalog.Admin;

/// <summary>
/// Собирает ошибки валидации по полям запроса. Имена полей — как в JSON (camelCase), чтобы клиент мог
/// показать сообщение рядом с нужным полем формы.
/// </summary>
internal sealed class ValidationErrors
{
    public const string SlugFormatMessage =
        "Slug может содержать только строчные латинские буквы, цифры и дефисы между ними, например «aurora-i-80».";

    private readonly Dictionary<string, List<string>> _errors = new(StringComparer.Ordinal);

    public bool HasErrors => _errors.Count > 0;

    public void Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var messages))
        {
            messages = [];
            _errors[field] = messages;
        }

        messages.Add(message);
    }

    /// <summary>Обязательная строка без пробелов по краям; пустая строка, если значение не задано.</summary>
    public string Required(string field, string? value, int maxLength, string requiredMessage)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            Add(field, requiredMessage);
            return string.Empty;
        }

        CheckLength(field, trimmed, maxLength);
        return trimmed;
    }

    /// <summary>Необязательная строка без пробелов по краям; <c>null</c> вместо пустой.</summary>
    public string? Optional(string field, string? value, int maxLength)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        CheckLength(field, trimmed, maxLength);
        return trimmed;
    }

    /// <summary>
    /// Slug из запроса, если он передан; иначе прежний (при изменении записи) или сформированный из названия
    /// (при создании). Ошибки пишутся в поле <c>slug</c>.
    /// </summary>
    public string ResolveSlug(string? requested, string name, string? current, int maxLength)
    {
        var slug = requested?.Trim();
        if (!string.IsNullOrEmpty(slug))
        {
            if (!Slugs.IsValid(slug))
            {
                Add("slug", SlugFormatMessage);
            }

            CheckLength("slug", slug, maxLength);
            return slug;
        }

        if (current is not null)
        {
            return current;
        }

        if (name.Length == 0)
        {
            // Название не задано — об этом уже есть ошибка, slug формировать не из чего.
            return string.Empty;
        }

        slug = Slugs.Generate(name, maxLength);
        if (slug.Length == 0)
        {
            Add("slug", "Не удалось сформировать slug из названия — укажите его явно.");
        }

        return slug;
    }

    public AdminError ToError() =>
        AdminError.Validation(_errors.ToDictionary(e => e.Key, e => e.Value.ToArray(), StringComparer.Ordinal));

    private void CheckLength(string field, string value, int maxLength)
    {
        if (value.Length > maxLength)
        {
            Add(field, $"Не длиннее {maxLength} символов.");
        }
    }
}
