using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;
using Microsoft.Extensions.Logging;

namespace HiFiStore.Infrastructure.Translation;

/// <summary>
/// Перевод через Claude API. Тексты уходят одним запросом, ответ — JSON по схеме с теми же полями
/// (structured outputs), поэтому разбирать свободный текст не нужно.
/// </summary>
public sealed class ClaudeMachineTranslator(ClaudeTranslationOptions options, ILogger<ClaudeMachineTranslator> logger) : IMachineTranslator
{
    private const string UnavailableMessage = "Сервис перевода сейчас недоступен. Попробуйте позже или переведите вручную.";

    private const string SystemPrompt =
        """
        You translate product content for an online shop of handmade hi-fi audio equipment
        (amplifiers, speakers, turntables, cables). The shop is Ukrainian; the translation is shown to English-speaking customers.

        Translate every field of the JSON object you receive into the target language and return the same fields.
        - Write natural, idiomatic copy a native speaker would use on a product page, not a word-for-word rendering.
        - Use the standard English hi-fi terms (for example, phono stage, integrated amplifier, tonearm, interconnect).
        - Keep brand names, model names, numbers, units and SKUs exactly as they are; transliterate Ukrainian brand names only if no Latin spelling is given.
        - Keep paragraph breaks and any Markdown formatting. Do not add, remove or invent facts.
        - Short values such as specification values ("Чорний", "Так", "Пряма") are translated as short values.
        """;

    private readonly AnthropicClient client = new()
    {
        ApiKey = options.ApiKey,
        Timeout = TimeSpan.FromSeconds(90),
    };

    public bool IsEnabled => true;

    public async Task<MachineTranslationResult> TranslateAsync(
        IReadOnlyDictionary<string, string> texts,
        string sourceLocale,
        string targetLocale,
        string context,
        CancellationToken ct = default)
    {
        if (texts.Count == 0)
        {
            return MachineTranslationResult.Ok(new Dictionary<string, string>());
        }

        // Ключи полей бывают любыми (например, ключи характеристик), в схеме используем свои: f0, f1, ...
        var fields = texts.Keys.ToList();
        var input = fields.Select((key, index) => (Id: $"f{index}", Text: texts[key])).ToList();

        var request = new MessageCreateParams
        {
            Model = options.Model,
            MaxTokens = 16000,
            System = SystemPrompt,
            OutputConfig = new OutputConfig
            {
                Effort = Effort.Medium,
                Format = new JsonOutputFormat { Schema = BuildSchema(input.Select(i => i.Id)) },
            },
            Messages =
            [
                new UserMessageParam
                {
                    Content =
                        $"Source language: {sourceLocale}. Target language: {targetLocale}. Content: {context}.\n\n" +
                        JsonSerializer.Serialize(input.ToDictionary(i => i.Id, i => i.Text)),
                },
            ],
        };

        Message response;
        try
        {
            response = await client.Messages.Create(request, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is AnthropicException or HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Claude API не перевёл текст ({Context})", context);
            return MachineTranslationResult.Failed(UnavailableMessage);
        }

        if (response.StopReason == "refusal")
        {
            logger.LogWarning("Claude API отказался переводить ({Context})", context);
            return MachineTranslationResult.Failed("Сервис перевода отказался переводить этот текст. Переведите его вручную.");
        }

        if (response.StopReason == "max_tokens")
        {
            return MachineTranslationResult.Failed("Текст слишком длинный для автоперевода. Переведите описание частями или вручную.");
        }

        var json = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
        try
        {
            using var document = JsonDocument.Parse(json);
            var result = new Dictionary<string, string>(StringComparer.Ordinal);
            for (var i = 0; i < input.Count; i++)
            {
                if (!document.RootElement.TryGetProperty(input[i].Id, out var value)
                    || value.ValueKind != JsonValueKind.String
                    || string.IsNullOrWhiteSpace(value.GetString()))
                {
                    throw new JsonException($"Нет поля {input[i].Id}.");
                }

                result[fields[i]] = value.GetString()!.Trim();
            }

            return MachineTranslationResult.Ok(result);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Claude API вернул неполный перевод ({Context})", context);
            return MachineTranslationResult.Failed(UnavailableMessage);
        }
    }

    private static Dictionary<string, JsonElement> BuildSchema(IEnumerable<string> ids)
    {
        var list = ids.ToList();
        return new Dictionary<string, JsonElement>
        {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["properties"] = JsonSerializer.SerializeToElement(list.ToDictionary(id => id, _ => new { type = "string" })),
            ["required"] = JsonSerializer.SerializeToElement(list),
            ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
        };
    }
}
