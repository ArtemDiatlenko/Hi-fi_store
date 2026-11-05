namespace HiFiStore.Infrastructure.Catalog.Admin;

public enum AdminErrorKind
{
    /// <summary>Запись не найдена (404).</summary>
    NotFound,

    /// <summary>Некорректные данные запроса (400), ошибки по полям — в <see cref="AdminError.Errors"/>.</summary>
    Validation,

    /// <summary>Операция противоречит текущему состоянию данных (409): занятый slug, удаление используемой записи и т. п.</summary>
    Conflict,

    /// <summary>Внешний сервис не ответил или не настроен (503).</summary>
    Unavailable,
}

/// <summary>Ошибка операции административного каталога. Сообщения — для показа администратору.</summary>
public sealed record AdminError(AdminErrorKind Kind, string Message, IReadOnlyDictionary<string, string[]>? Errors = null)
{
    public static AdminError NotFound(string message) => new(AdminErrorKind.NotFound, message);

    public static AdminError Conflict(string message) => new(AdminErrorKind.Conflict, message);

    public static AdminError Unavailable(string message) => new(AdminErrorKind.Unavailable, message);

    public static AdminError Validation(IReadOnlyDictionary<string, string[]> errors) =>
        new(AdminErrorKind.Validation, "Проверьте введённые данные.", errors);

    public static AdminError Validation(string field, string message) =>
        Validation(new Dictionary<string, string[]> { [field] = [message] });
}

/// <summary>Результат операции без значения: успех или <see cref="AdminError"/>.</summary>
public sealed class AdminResult
{
    private AdminResult(AdminError? error) => Error = error;

    public static AdminResult Success { get; } = new(null);

    public AdminError? Error { get; }

    public static implicit operator AdminResult(AdminError error) => new(error);
}

/// <summary>Результат операции: значение или <see cref="AdminError"/>.</summary>
public sealed class AdminResult<T>
{
    private AdminResult(T? value, AdminError? error)
    {
        Value = value;
        Error = error;
    }

    /// <summary>Значение; заполнено, когда <see cref="Error"/> равно <c>null</c>.</summary>
    public T? Value { get; }

    public AdminError? Error { get; }

    public static implicit operator AdminResult<T>(T value) => new(value, null);

    public static implicit operator AdminResult<T>(AdminError error) => new(default, error);
}
