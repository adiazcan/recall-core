namespace Recall.Core.Enrichment.Models;

public sealed record EnrichmentJob
{
    public required string ItemId { get; init; }
    public required string UserId { get; init; }
    public required string Url { get; init; }
    public required DateTime EnqueuedAt { get; init; }
}
