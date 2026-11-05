using HiFiStore.Infrastructure.Translation;

namespace HiFiStore.Tests.Integration;

/// <summary>Переводчик для тестов: приписывает «EN:» к тексту, запоминает последний запрос, может «упасть».</summary>
public sealed class FakeMachineTranslator : IMachineTranslator
{
    public bool IsEnabled { get; set; }

    public bool Fail { get; set; }

    public IReadOnlyDictionary<string, string>? LastTexts { get; private set; }

    public Task<MachineTranslationResult> TranslateAsync(
        IReadOnlyDictionary<string, string> texts, string sourceLocale, string targetLocale, string context, CancellationToken ct = default)
    {
        LastTexts = texts;
        return Task.FromResult(Fail
            ? MachineTranslationResult.Failed("Сервис перевода сейчас недоступен.")
            : MachineTranslationResult.Ok(texts.ToDictionary(t => t.Key, t => $"EN:{t.Value}")));
    }
}
