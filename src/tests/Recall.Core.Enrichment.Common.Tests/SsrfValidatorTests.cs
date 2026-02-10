using Recall.Core.Enrichment.Common.Services;

namespace Recall.Core.Enrichment.Common.Tests;

public sealed class SsrfValidatorTests
{
    private readonly ISsrfValidator _validator = new SsrfValidator();

    [Theory]
    [InlineData("http://10.0.0.1")]
    [InlineData("http://172.16.0.1")]
    [InlineData("http://192.168.1.1")]
    [InlineData("http://127.0.0.1")]
    [InlineData("http://169.254.1.1")]
    [InlineData("http://[::1]")]
    [InlineData("http://[fd00::1]")]
    [InlineData("http://[fe80::1]")]
    public async Task ValidateAsync_BlocksPrivateOrLocalAddresses(string url)
    {
        var result = await _validator.ValidateAsync(url);

        Assert.False(result.IsAllowed);
        Assert.NotNull(result.ErrorMessage);
    }

    [Theory]
    [InlineData("ftp://example.com")]
    [InlineData("file:///etc/passwd")]
    public async Task ValidateAsync_BlocksNonHttpSchemes(string url)
    {
        var result = await _validator.ValidateAsync(url);

        Assert.False(result.IsAllowed);
        Assert.Equal("Only http/https URLs are allowed.", result.ErrorMessage);
    }

    [Fact]
    public async Task ValidateAsync_BlocksDomainsResolvingToLoopback()
    {
        var result = await _validator.ValidateAsync("http://localhost");

        Assert.False(result.IsAllowed);
        Assert.NotNull(result.ErrorMessage);
    }

    [Fact]
    public async Task ValidateAsync_AllowsPublicIp()
    {
        var result = await _validator.ValidateAsync("https://8.8.8.8");

        Assert.True(result.IsAllowed);
        Assert.Null(result.ErrorMessage);
    }
}
