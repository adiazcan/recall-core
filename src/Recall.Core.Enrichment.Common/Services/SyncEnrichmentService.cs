using System.Diagnostics;
using System.Net;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Recall.Core.Enrichment.Common.Configuration;
using Recall.Core.Enrichment.Common.Models;

namespace Recall.Core.Enrichment.Common.Services;

public sealed class SyncEnrichmentService : ISyncEnrichmentService
{
    private const int TitleMaxLength = 200;
    private const int ExcerptMaxLength = 500;
    private const int ErrorMaxLength = 500;

    private readonly ISsrfValidator _ssrfValidator;
    private readonly IHtmlFetcher _htmlFetcher;
    private readonly IMetadataExtractor _metadataExtractor;
    private readonly EnrichmentOptions _options;
    private readonly ILogger<SyncEnrichmentService> _logger;

    public SyncEnrichmentService(
        ISsrfValidator ssrfValidator,
        IHtmlFetcher htmlFetcher,
        IMetadataExtractor metadataExtractor,
        EnrichmentOptions options,
        ILogger<SyncEnrichmentService> logger)
    {
        _ssrfValidator = ssrfValidator;
        _htmlFetcher = htmlFetcher;
        _metadataExtractor = metadataExtractor;
        _options = options;
        _logger = logger;
    }

    public async Task<SyncEnrichmentResult> EnrichAsync(
        string url,
        string userId,
        string itemId,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        using var masterCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        masterCts.CancelAfter(TimeSpan.FromSeconds(_options.MasterTimeoutSeconds));

        _logger.LogInformation(
            "Sync enrichment started. ItemId={ItemId} UserId={UserId} Url={Url}",
            itemId,
            userId,
            url);

        try
        {
            var validation = await _ssrfValidator.ValidateAsync(url, masterCts.Token);
            if (!validation.IsAllowed)
            {
                throw new SsrfBlockedException("URL blocked.");
            }

            using var fetchCts = CancellationTokenSource.CreateLinkedTokenSource(masterCts.Token);
            fetchCts.CancelAfter(TimeSpan.FromSeconds(_options.FetchTimeoutSeconds));

            var html = await _htmlFetcher.FetchHtmlAsync(url, fetchCts.Token);
            var metadata = await _metadataExtractor.ExtractAsync(html);

            var title = SanitizeText(metadata.Title, TitleMaxLength);
            var excerpt = SanitizeText(metadata.Excerpt, ExcerptMaxLength);
            var previewImageUrl = SanitizeUrl(metadata.OgImageUrl);
            var needsAsyncFallback = string.IsNullOrWhiteSpace(previewImageUrl);

            if (needsAsyncFallback)
            {
                _logger.LogInformation(
                    "Sync enrichment partial (no preview image). ItemId={ItemId} UserId={UserId} Url={Url} DurationMs={DurationMs}",
                    itemId,
                    userId,
                    url,
                    stopwatch.Elapsed.TotalMilliseconds);
            }
            else
            {
                _logger.LogInformation(
                    "Sync enrichment succeeded. ItemId={ItemId} UserId={UserId} Url={Url} DurationMs={DurationMs}",
                    itemId,
                    userId,
                    url,
                    stopwatch.Elapsed.TotalMilliseconds);
            }

            return new SyncEnrichmentResult(
                title,
                excerpt,
                previewImageUrl,
                needsAsyncFallback,
                null,
                stopwatch.Elapsed);
        }
        catch (SsrfBlockedException)
        {
            _logger.LogWarning(
                "Sync enrichment blocked by SSRF. ItemId={ItemId} UserId={UserId} Url={Url}",
                itemId,
                userId,
                url);

            return new SyncEnrichmentResult(
                null,
                null,
                null,
                false,
                "URL blocked.",
                stopwatch.Elapsed);
        }
        catch (OperationCanceledException) when (masterCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Sync enrichment timed out. ItemId={ItemId} UserId={UserId} Url={Url} DurationMs={DurationMs}",
                itemId,
                userId,
                url,
                stopwatch.Elapsed.TotalMilliseconds);

            return new SyncEnrichmentResult(
                null,
                null,
                null,
                true,
                null,
                stopwatch.Elapsed);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning(
                "Sync enrichment canceled. ItemId={ItemId} UserId={UserId} Url={Url} DurationMs={DurationMs}",
                itemId,
                userId,
                url,
                stopwatch.Elapsed.TotalMilliseconds);

            return new SyncEnrichmentResult(
                null,
                null,
                null,
                true,
                null,
                stopwatch.Elapsed);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Sync enrichment failed. ItemId={ItemId} UserId={UserId} Url={Url}",
                itemId,
                userId,
                url);

            return new SyncEnrichmentResult(
                null,
                null,
                null,
                true,
                null,
                stopwatch.Elapsed);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    private static string? SanitizeText(string? input, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        var decoded = WebUtility.HtmlDecode(input);
        var stripped = Regex.Replace(decoded, "<[^>]*>", string.Empty);
        var normalized = Regex.Replace(stripped, "\\s+", " ").Trim();

        if (normalized.Length <= maxLength)
        {
            return normalized;
        }

        return normalized[..maxLength].TrimEnd() + "...";
    }

    private static string? SanitizeUrl(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        var trimmed = input.Trim();
        if (trimmed.Length == 0)
        {
            return null;
        }

        return trimmed.Length <= ErrorMaxLength
            ? trimmed
            : trimmed[..ErrorMaxLength];
    }
}
