namespace Recall.Core.Enrichment.Services;

public interface IMetadataExtractor
{
    Task<PageMetadata> ExtractAsync(string html, CancellationToken cancellationToken = default);
}

public sealed record PageMetadata(string? Title, string? Excerpt, string? OgImageUrl);
