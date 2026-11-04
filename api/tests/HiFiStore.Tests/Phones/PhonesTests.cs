using HiFiStore.Infrastructure;

namespace HiFiStore.Tests.Phones;

public sealed class PhonesTests
{
    [Theory]
    [InlineData("067 123 45 67", "671234567")]
    [InlineData("+380 (67) 123-45-67", "380671234567")]
    [InlineData("12", "")]
    [InlineData("Олена", "")]
    public void SearchDigits_DropsSeparatorsAndLeadingZeros(string term, string expected) =>
        Assert.Equal(expected, HiFiStore.Infrastructure.Phones.SearchDigits(term));
}
