using Microsoft.Extensions.Logging;
using Recall.Core.Enrichment.Common.Configuration;
using Recall.Core.Enrichment.Common.Models;
using Recall.Core.Enrichment.Common.Services;

namespace Recall.Core.Enrichment.Common.Tests;

public sealed class SyncEnrichmentServiceTests
{
    [Fact]
    public async Task EnrichAsync_ReturnsSuccessWhenPreviewImageFound()
    {
        var service = CreateService(
            ssrfValidator: new AllowAllSsrfValidator(),
            htmlFetcher: new FixedHtmlFetcher("<html></html>"),
            metadataExtractor: new FixedMetadataExtractor(new PageMetadata("Title", "Excerpt", "https://example.com/og.png")));

        var result = await service.EnrichAsync("https://example.com", "user-1", "item-1");

        Assert.Equal("Title", result.Title);
        Assert.Equal("Excerpt", result.Excerpt);
        Assert.Equal("https://example.com/og.png", result.PreviewImageUrl);
        Assert.False(result.NeedsAsyncFallback);
        Assert.Null(result.Error);
        Assert.True(result.Duration >= TimeSpan.Zero);
    }

    [Fact]
    public async Task EnrichAsync_ReturnsPartialWhenPreviewImageMissing()
    {
        var service = CreateService(
            ssrfValidator: new AllowAllSsrfValidator(),
            htmlFetcher: new FixedHtmlFetcher("<html></html>"),
            metadataExtractor: new FixedMetadataExtractor(new PageMetadata("Title", "Excerpt", null)));

        var result = await service.EnrichAsync("https://example.com", "user-1", "item-1");

        Assert.Equal("Title", result.Title);
        Assert.Equal("Excerpt", result.Excerpt);
        Assert.Null(result.PreviewImageUrl);
        Assert.True(result.NeedsAsyncFallback);
        Assert.Null(result.Error);
    }

    [Fact]
    public async Task EnrichAsync_ReturnsFallbackOnTimeout()
    {
        var service = CreateService(
            ssrfValidator: new AllowAllSsrfValidator(),
            htmlFetcher: new DelayedHtmlFetcher(TimeSpan.FromSeconds(5)),
            metadataExtractor: new FixedMetadataExtractor(new PageMetadata("Title", "Excerpt", null)),
            options: new EnrichmentOptions { MasterTimeoutSeconds = 1, FetchTimeoutSeconds = 1 });

        var result = await service.EnrichAsync("https://example.com/slow", "user-1", "item-1");

        Assert.True(result.NeedsAsyncFallback);
        Assert.Null(result.Error);
        Assert.Null(result.PreviewImageUrl);
        Assert.Null(result.Title);
        Assert.Null(result.Excerpt);
    }

    [Fact]
    public async Task EnrichAsync_ReturnsBlockedWhenSsrfRejected()
    {
        var htmlFetcher = new FixedHtmlFetcher("<html></html>");
        var service = CreateService(
            ssrfValidator: new BlockAllSsrfValidator(),
            htmlFetcher: htmlFetcher,
            metadataExtractor: new FixedMetadataExtractor(new PageMetadata("Title", "Excerpt", "https://example.com/og.png")));

        var result = await service.EnrichAsync("http://192.168.1.1", "user-1", "item-1");

        Assert.False(result.NeedsAsyncFallback);
        Assert.Equal("URL blocked.", result.Error);
        Assert.Null(result.PreviewImageUrl);
        Assert.False(htmlFetcher.WasCalled);
    }

    private static SyncEnrichmentService CreateService(
        ISsrfValidator ssrfValidator,
        IHtmlFetcher htmlFetcher,
        IMetadataExtractor metadataExtractor,
        EnrichmentOptions? options = null)
    {
        options ??= new EnrichmentOptions { MasterTimeoutSeconds = 4, FetchTimeoutSeconds = 3 };
        var loggerFactory = LoggerFactory.Create(builder => builder.AddFilter(_ => false));

        return new SyncEnrichmentService(
            ssrfValidator,
            htmlFetcher,
            metadataExtractor,
            options,
            loggerFactory.CreateLogger<SyncEnrichmentService>());
    }

    private sealed class FixedHtmlFetcher : IHtmlFetcher
    {
        private readonly string _html;
        public bool WasCalled { get; private set; }

        public FixedHtmlFetcher(string html)
        {
            _html = html;
        }

        public Task<string> FetchHtmlAsync(string url, CancellationToken cancellationToken = default)
        {
            WasCalled = true;
            return Task.FromResult(_html);
        }
    }

    private sealed class DelayedHtmlFetcher : IHtmlFetcher
    {
        private readonly TimeSpan _delay;

        public DelayedHtmlFetcher(TimeSpan delay)
        {
            _delay = delay;
        }

        public async Task<string> FetchHtmlAsync(string url, CancellationToken cancellationToken = default)
        {
            await Task.Delay(_delay, cancellationToken);
            return "<html></html>";
        }
    }

    private sealed class FixedMetadataExtractor : IMetadataExtractor
    {
        private readonly PageMetadata _metadata;

        public FixedMetadataExtractor(PageMetadata metadata)
        {
            _metadata = metadata;
        }

        public Task<PageMetadata> ExtractAsync(string html)
        {
            return Task.FromResult(_metadata);
        }
    }

    private sealed class AllowAllSsrfValidator : ISsrfValidator
    {
        public Task<SsrfValidationResult> ValidateAsync(string url, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new SsrfValidationResult(true, null));
        }
    }

    private sealed class BlockAllSsrfValidator : ISsrfValidator
    {
        public Task<SsrfValidationResult> ValidateAsync(string url, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new SsrfValidationResult(false, "URL blocked."));
        }
    }
}
