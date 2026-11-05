namespace HiFiStore.Infrastructure.Translation;

/// <summary>
/// Машинный перевод контента каталога (секция <c>Translation</c>). По умолчанию выключен (<c>None</c>):
/// кнопка автоперевода в админке не показывается. <c>Claude</c> — перевод через Claude API, нужен ключ.
/// </summary>
public sealed class TranslationOptions
{
    public const string Section = "Translation";

    /// <summary>None (по умолчанию) или Claude.</summary>
    public string Provider { get; set; } = "None";

    public ClaudeTranslationOptions Claude { get; set; } = new();
}

public sealed class ClaudeTranslationOptions
{
    /// <summary>Ключ Claude API. Задаётся переменной окружения <c>Translation__Claude__ApiKey</c>, не в appsettings.</summary>
    public string? ApiKey { get; set; }

    public string Model { get; set; } = "claude-opus-5-5";
}

/// <summary>Результат машинного перевода: тексты по тем же ключам, что и в запросе, или сообщение об ошибке.</summary>
public sealed record MachineTranslationResult(IReadOnlyDictionary<string, string>? Texts, string? Error)
{
    public static MachineTranslationResult Ok(IReadOnlyDictionary<string, string> texts) => new(texts, null);

    public static MachineTranslationResult Failed(string error) => new(null, error);
}

/// <summary>Переводчик коротких текстов каталога: ключ поля → текст на исходном языке.</summary>
public interface IMachineTranslator
{
    /// <summary>Настроен ли перевод. Если нет, админка не показывает кнопку.</summary>
    bool IsEnabled { get; }

    /// <param name="texts">Ключ поля → непустой текст на <paramref name="sourceLocale"/>.</param>
    /// <param name="context">Что переводится (например, «товар: проигрыватель»), чтобы выбрать термины.</param>
    Task<MachineTranslationResult> TranslateAsync(
        IReadOnlyDictionary<string, string> texts,
        string sourceLocale,
        string targetLocale,
        string context,
        CancellationToken ct = default);
}

/// <summary>Перевод не настроен.</summary>
public sealed class DisabledMachineTranslator : IMachineTranslator
{
    public bool IsEnabled => false;

    public Task<MachineTranslationResult> TranslateAsync(
        IReadOnlyDictionary<string, string> texts, string sourceLocale, string targetLocale, string context, CancellationToken ct = default) =>
        Task.FromResult(MachineTranslationResult.Failed("Автоперевод не настроен."));
}
