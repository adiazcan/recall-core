using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Net;
using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using Recall.Core.Enrichment.Models;
using Recall.Core.Enrichment.Storage;

namespace Recall.Core.Enrichment.Services;

public sealed class EnrichmentService : IEnrichmentService
{
    private const int TitleMaxLength = 200;
    private const int ExcerptMaxLength = 500;
    private const int ErrorMaxLength = 500;

    private readonly IMongoCollection<ItemDocument> _items;
    private readonly IHtmlFetcher _htmlFetcher;
    private readonly IMetadataExtractor _metadataExtractor;
    private readonly IThumbnailGenerator _thumbnailGenerator;
    private readonly IThumbnailStorage _thumbnailStorage;
    private readonly ILogger<EnrichmentService> _logger;
    private readonly Counter<long> _jobsSucceeded;
    private readonly Counter<long> _jobsFailed;
    private readonly Histogram<double> _jobDuration;

    public EnrichmentService(
        IMongoDatabase database,
        IHtmlFetcher htmlFetcher,
        IMetadataExtractor metadataExtractor,
        IThumbnailGenerator thumbnailGenerator,
        IThumbnailStorage thumbnailStorage,
        ILogger<EnrichmentService> logger,
        IMeterFactory meterFactory)
    {
        _items = database.GetCollection<ItemDocument>("items");
        _htmlFetcher = htmlFetcher;
        _metadataExtractor = metadataExtractor;
        _thumbnailGenerator = thumbnailGenerator;
        _thumbnailStorage = thumbnailStorage;
        _logger = logger;

        var meter = meterFactory.Create("Recall.Core.Enrichment");
        _jobsSucceeded = meter.CreateCounter<long>("enrichment.jobs.succeeded");
        _jobsFailed = meter.CreateCounter<long>("enrichment.jobs.failed");
        _jobDuration = meter.CreateHistogram<double>("enrichment.jobs.duration", "ms");
    }

    public async Task EnrichAsync(EnrichmentJob job, CancellationToken cancellationToken = default)
    {
        if (!ObjectId.TryParse(job.ItemId, out var itemId))
        {
            _logger.LogWarning("Enrichment job has invalid item id. ItemId={ItemId} UserId={UserId}", job.ItemId, job.UserId);
            return;
        }

        var filter = Builders<ItemDocument>.Filter.Eq(item => item.Id, itemId)
            & Builders<ItemDocument>.Filter.Eq(item => item.UserId, job.UserId);
        var item = await _items.Find(filter).FirstOrDefaultAsync(cancellationToken);
        if (item is null)
        {
            _logger.LogWarning("Enrichment job item not found. ItemId={ItemId} UserId={UserId}", job.ItemId, job.UserId);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var html = await _htmlFetcher.FetchHtmlAsync(job.Url, cancellationToken);
            var metadata = await _metadataExtractor.ExtractAsync(html, cancellationToken);

            var title = item.Title ?? SanitizeText(metadata.Title, TitleMaxLength);
            var excerpt = item.Excerpt ?? SanitizeText(metadata.Excerpt, ExcerptMaxLength);

            string? thumbnailKey = null;
            var thumbnailBytes = await _thumbnailGenerator.GenerateAsync(job.Url, metadata.OgImageUrl, cancellationToken);
            if (thumbnailBytes is not null)
            {
                thumbnailKey = await _thumbnailStorage.SaveThumbnailAsync(job.UserId, job.ItemId, thumbnailBytes, cancellationToken);
            }

            await UpdateResultAsync(
                job.UserId,
                itemId,
                title,
                excerpt,
                thumbnailKey,
                "succeeded",
                null,
                DateTime.UtcNow,
                cancellationToken);

            _jobsSucceeded.Add(1);
        }
        catch (Exception ex)
        {
            var error = SanitizeError(ex);
            await UpdateResultAsync(
                job.UserId,
                itemId,
                null,
                null,
                null,
                "failed",
                error,
                null,
                cancellationToken);

            _jobsFailed.Add(1);
            _logger.LogWarning(ex, "Enrichment failed. ItemId={ItemId} UserId={UserId}", job.ItemId, job.UserId);
            throw;
        }
        finally
        {
            stopwatch.Stop();
            _jobDuration.Record(stopwatch.Elapsed.TotalMilliseconds);
        }
    }

    public async Task MarkFailedAsync(EnrichmentJob job, string error, CancellationToken cancellationToken = default)
    {
        if (!ObjectId.TryParse(job.ItemId, out var itemId))
        {
            _logger.LogWarning("Dead letter item id invalid. ItemId={ItemId} UserId={UserId}", job.ItemId, job.UserId);
            return;
        }

        await UpdateResultAsync(
            job.UserId,
            itemId,
            null,
            null,
            null,
            "failed",
            SanitizeError(error),
            null,
            cancellationToken);
    }

    private async Task UpdateResultAsync(
        string userId,
        ObjectId itemId,
        string? title,
        string? excerpt,
        string? thumbnailKey,
        string status,
        string? error,
        DateTime? enrichedAt,
        CancellationToken cancellationToken)
    {
        var updates = new List<UpdateDefinition<ItemDocument>>
        {
            Builders<ItemDocument>.Update.Set(item => item.EnrichmentStatus, status),
            Builders<ItemDocument>.Update.Set(item => item.EnrichmentError, error),
            Builders<ItemDocument>.Update.Set(item => item.EnrichedAt, enrichedAt),
            Builders<ItemDocument>.Update.Set(item => item.UpdatedAt, DateTime.UtcNow)
        };

        if (title is not null)
        {
            updates.Add(Builders<ItemDocument>.Update.Set(item => item.Title, title));
        }

        if (excerpt is not null)
        {
            updates.Add(Builders<ItemDocument>.Update.Set(item => item.Excerpt, excerpt));
        }

        if (thumbnailKey is not null)
        {
            updates.Add(Builders<ItemDocument>.Update.Set(item => item.ThumbnailStorageKey, thumbnailKey));
        }

        var update = Builders<ItemDocument>.Update.Combine(updates);
        await _items.UpdateOneAsync(
            item => item.Id == itemId && item.UserId == userId,
            update,
            cancellationToken: cancellationToken);
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

    private static string SanitizeError(Exception ex)
    {
        var message = ex switch
        {
            SsrfBlockedException => ex.Message,
            HttpRequestException => "Failed to fetch page.",
            TaskCanceledException => "Fetch timed out.",
            InvalidOperationException invalidOperation when invalidOperation.Message.Contains("Response too large", StringComparison.OrdinalIgnoreCase)
                => "Page too large to fetch.",
            InvalidOperationException invalidOperation when invalidOperation.Message.Contains("Too many redirects", StringComparison.OrdinalIgnoreCase)
                => "Too many redirects.",
            _ => "Enrichment failed."
        };

        return SanitizeError(message);
    }

    private static string SanitizeError(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return "Enrichment failed.";
        }

        var trimmed = message.Trim();
        return trimmed.Length <= ErrorMaxLength
            ? trimmed
            : trimmed[..ErrorMaxLength];
    }

    private sealed class ItemDocument
    {
        [BsonId]
        [BsonElement("_id")]
        public ObjectId Id { get; set; }

        [BsonElement("userId")]
        public string? UserId { get; set; }

        [BsonElement("title")]
        public string? Title { get; set; }

        [BsonElement("excerpt")]
        public string? Excerpt { get; set; }

        [BsonElement("thumbnailStorageKey")]
        public string? ThumbnailStorageKey { get; set; }

        [BsonElement("enrichmentStatus")]
        public string EnrichmentStatus { get; set; } = "pending";

        [BsonElement("enrichmentError")]
        public string? EnrichmentError { get; set; }

        [BsonElement("enrichedAt")]
        public DateTime? EnrichedAt { get; set; }

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; }
    }
}
