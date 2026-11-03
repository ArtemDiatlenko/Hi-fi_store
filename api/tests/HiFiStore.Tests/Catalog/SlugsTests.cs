using HiFiStore.Infrastructure.Catalog;

namespace HiFiStore.Tests.Catalog;

public class SlugsTests
{
    [Theory]
    [InlineData("Аурора I-150 Pro", "aurora-i-150-pro")]
    [InlineData("Кварц Вращение 1", "kvarts-vrashchenie-1")]
    [InlineData("Норд Аудио NS-5 Walnut", "nord-audio-ns-5-walnut")]
    [InlineData("Линия Mini 2", "liniya-mini-2")]
    [InlineData("Щука, жук и юла!", "shchuka-zhuk-i-yula")]
    [InlineData("Съёмный объект", "semnyy-obekt")]
    [InlineData("Хэтчбек Цапля", "khetchbek-tsaplya")]
    [InlineData("Їжак Ґудзик Єнот", "yizhak-gudzik-yenot")]
    [InlineData("Ламповий підсилювач", "lampoviy-pidsilyuvach")]
    public void Generate_TransliteratesCyrillic(string text, string expected) =>
        Assert.Equal(expected, Slugs.Generate(text));

    [Theory]
    [InlineData("Bowers & Wilkins", "bowers-wilkins")]
    [InlineData("  --Hello,   World--  ", "hello-world")]
    [InlineData("Линия — Silver RCA 1.0", "liniya-silver-rca-1-0")]
    [InlineData("Café Crème Brûlée", "cafe-creme-brulee")]
    [InlineData("Bang & Olufsen Beosound Ø", "bang-olufsen-beosound-o")]
    [InlineData("Straße", "strasse")]
    [InlineData("ALL CAPS 2000", "all-caps-2000")]
    public void Generate_NormalizesLatinAndSeparators(string text, string expected) =>
        Assert.Equal(expected, Slugs.Generate(text));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("!!! — ???")]
    [InlineData("中文")]
    public void Generate_ReturnsEmptyWhenNothingToKeep(string? text) =>
        Assert.Equal(string.Empty, Slugs.Generate(text));

    [Fact]
    public void Generate_TruncatesWithoutTrailingHyphen()
    {
        var slug = Slugs.Generate("Очень длинное название усилителя для проверки", maxLength: 20);

        Assert.True(slug.Length <= 20, slug);
        Assert.False(slug.EndsWith('-'), slug);
        Assert.StartsWith("ochen-dlinnoe", slug);
        Assert.True(Slugs.IsValid(slug));
    }

    [Theory]
    [InlineData("Аурора I-80")]
    [InlineData("Ламповый усилитель 2×EL34 (б/у)")]
    [InlineData("Hi-Fi & High-End")]
    public void Generate_ProducesValidSlug(string text) =>
        Assert.True(Slugs.IsValid(Slugs.Generate(text)));

    [Theory]
    [InlineData("aurora-i-80", true)]
    [InlineData("a", true)]
    [InlineData("2024", true)]
    [InlineData("Aurora", false)]
    [InlineData("aurora--i", false)]
    [InlineData("-aurora", false)]
    [InlineData("aurora-", false)]
    [InlineData("aurora_i", false)]
    [InlineData("aurora i", false)]
    [InlineData("аурора", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValid_ChecksFormat(string? slug, bool expected) =>
        Assert.Equal(expected, Slugs.IsValid(slug));
}
