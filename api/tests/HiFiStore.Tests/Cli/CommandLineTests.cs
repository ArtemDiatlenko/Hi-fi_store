using HiFiStore.Api.Cli;

namespace HiFiStore.Tests.Cli;

public class CommandLineTests
{
    [Fact]
    public void NoArguments_StartWebApp() =>
        Assert.IsType<CliCommand.RunWebApp>(CommandLine.Parse([]));

    [Theory]
    [InlineData("--urls", "http://localhost:5000")]
    [InlineData("--environment=Production")]
    public void HostSwitches_StartWebApp(params string[] args) =>
        Assert.IsType<CliCommand.RunWebApp>(CommandLine.Parse(args));

    [Fact]
    public void Migrate() =>
        Assert.IsType<CliCommand.Migrate>(CommandLine.Parse(["migrate"]));

    [Fact]
    public void Migrate_WithArguments_IsUsageError() =>
        AssertUsageError(CommandLine.Parse(["migrate", "now"]), "migrate");

    [Theory]
    [InlineData(new[] { "create-admin", "--email", "admin@example.com" }, false)]
    [InlineData(new[] { "create-admin", "--email=admin@example.com" }, false)]
    [InlineData(new[] { "create-admin", "--reset-password", "--email", " admin@example.com " }, true)]
    [InlineData(new[] { "create-admin", "--email", "admin@example.com", "--reset-password" }, true)]
    public void CreateAdmin(string[] args, bool resetPassword) =>
        Assert.Equal(new CliCommand.CreateAdmin("admin@example.com", resetPassword), CommandLine.Parse(args));

    [Theory]
    [InlineData("create-admin")]
    [InlineData("create-admin", "--email")]
    [InlineData("create-admin", "--email=")]
    [InlineData("create-admin", "--email", "--reset-password")]
    public void CreateAdmin_WithoutEmail_IsUsageError(params string[] args) =>
        AssertUsageError(CommandLine.Parse(args), "--email");

    [Fact]
    public void CreateAdmin_DuplicateEmail_IsUsageError() =>
        AssertUsageError(CommandLine.Parse(["create-admin", "--email", "a@example.com", "--email", "b@example.com"]), "--email");

    [Theory]
    [InlineData("create-admin", "--email", "admin@example.com", "--password", "secret")]
    [InlineData("create-admin", "--email", "admin@example.com", "--password=secret")]
    public void CreateAdmin_PasswordArgument_IsRejected(params string[] args) =>
        AssertUsageError(CommandLine.Parse(args), AdminPasswordSource.VariableName);

    [Theory]
    [InlineData("create-admin", "--email", "admin@example.com", "--force")]
    [InlineData("create-admin", "--email", "admin@example.com", "extra")]
    [InlineData("create-admin", "--email", "admin@example.com", "--reset-password=yes")]
    public void CreateAdmin_UnknownOption_IsUsageError(params string[] args) =>
        AssertUsageError(CommandLine.Parse(args), "Неизвестный параметр");

    [Theory]
    [InlineData("seed")]
    [InlineData("Migrate")]
    [InlineData("createadmin")]
    public void UnknownCommand_IsUsageError(string name) =>
        AssertUsageError(CommandLine.Parse([name]), $"«{name}»");

    [Theory]
    [InlineData("help")]
    [InlineData("--help")]
    [InlineData("-h")]
    public void Help_ShowsUsageWithSuccess(string arg) =>
        Assert.Equal(new CliCommand.Usage(ExitCodes.Success), CommandLine.Parse([arg]));

    [Fact]
    public async Task UnknownCommand_PrintsUsageToStderr_AndExitsWith2()
    {
        var output = new StringWriter();
        var error = new StringWriter();

        var code = await StoreCli.RunAsync(CommandLine.Parse(["frobnicate"]), output, error);

        Assert.Equal(2, code);
        Assert.Empty(output.ToString());
        Assert.Contains("Неизвестная команда «frobnicate»", error.ToString());
        Assert.Contains("create-admin --email", error.ToString());
    }

    [Fact]
    public async Task Help_PrintsUsageToStdout_AndExitsWith0()
    {
        var output = new StringWriter();
        var error = new StringWriter();

        var code = await StoreCli.RunAsync(CommandLine.Parse(["--help"]), output, error);

        Assert.Equal(0, code);
        Assert.Equal(StoreCli.UsageText, output.ToString());
        Assert.Empty(error.ToString());
    }

    private static void AssertUsageError(CliCommand command, string messagePart)
    {
        var usage = Assert.IsType<CliCommand.Usage>(command);
        Assert.Equal(ExitCodes.Usage, usage.ExitCode);
        Assert.Contains(messagePart, usage.Error);
    }
}
