using System.Diagnostics;
using System.Diagnostics.Metrics;
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
    private readonly Counter<long> _syncSucceeded;
    private readonly Counter<long> _syncPartial;
    private readonly Counter<long> _syncFailed;
    private readonly Counter<long> _syncSsrfBlocked;
    private readonly Histogram<double> _syncDuration;

    public SyncEnrichmentService(
        ISsrfValidator ssrfValidator,
        IHtmlFetcher htmlFetcher,
        IMetadataExtractor metadataExtractor,
        EnrichmentOptions options,
        ILogger<SyncEnrichmentService> logger,
        IMeterFactory meterFactory)
    {
        _ssrfValidator = ssrfValidator;
        _htmlFetcher = htmlFetcher;
        _metadataExtractor = metadataExtractor;
        _options = options;
        _logger = logger;

        var meter = meterFactory.Create("Recall.Core.Enrichment");
        _syncSucceeded = meter.CreateCounter<long>("enrichment.sync.succeeded");
        _syncPartial = meter.CreateCounter<long>("enrichment.sync.partial");
        _syncFailed = meter.CreateCounter<long>("enrichment.sync.failed");
        _syncSsrfBlocked = meter.CreateCounter<long>("enrichment.sync.ssrf_blocked");
        _syncDuration = meter.CreateHistogram<double>("enrichment.sync.duration", "ms");
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
            var hasMetadata = !string.IsNullOrWhiteSpace(title) || !string.IsNullOrWhiteSpace(excerpt);

            if (needsAsyncFallback)
            {
                _logger.LogInformation(
                    "Sync enrichment partial (no preview image). ItemId={ItemId} UserId={UserId} Url={Url} DurationMs={DurationMs}",
                    itemId,
                    userId,
                    url,
                    stopwatch.Elapsed.TotalMilliseconds);

                if (hasMetadata)
                {
                    _syncPartial.Add(1);
                }
                else
                {
                    _syncFailed.Add(1);
                }
            }
            else
            {
                _logger.LogInformation(
                    "Sync enrichment succeeded. ItemId={ItemId} UserId={UserId} Url={Url} DurationMs={DurationMs}",
                    itemId,
                    userId,
                    url,
                    stopwatch.Elapsed.TotalMilliseconds);
                _syncSucceeded.Add(1);
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

            _syncSsrfBlocked.Add(1);

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

            _syncFailed.Add(1);

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

            _syncFailed.Add(1);

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

            _syncFailed.Add(1);

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
            _syncDuration.Record(stopwatch.Elapsed.TotalMilliseconds);
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
