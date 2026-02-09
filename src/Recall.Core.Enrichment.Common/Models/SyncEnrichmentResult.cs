namespace Recall.Core.Enrichment.Common.Models;

public sealed record SyncEnrichmentResult(
    string? Title,
    string? Excerpt,
    string? PreviewImageUrl,
    bool NeedsAsyncFallback,
    string? Error,
    TimeSpan Duration);
