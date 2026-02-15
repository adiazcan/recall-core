using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Models;

public sealed record ItemDto
{
    public string Id { get; init; } = string.Empty;
    public string Url { get; init; } = string.Empty;
    public string NormalizedUrl { get; init; } = string.Empty;
    public string? Title { get; init; }
    public string? Excerpt { get; init; }
    public string Status { get; init; } = "unread";
    public bool IsFavorite { get; init; }
    public string? CollectionId { get; init; }
    public IReadOnlyList<TagSummaryDto> Tags { get; init; } = Array.Empty<TagSummaryDto>();
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public string? PreviewImageUrl { get; init; }
    public string? ThumbnailUrl { get; init; }
    public string EnrichmentStatus { get; init; } = "pending";
    public string? EnrichmentError { get; init; }
    public DateTime? EnrichedAt { get; init; }

    public static ItemDto FromEntity(Item item, IReadOnlyList<TagSummaryDto> tags, string? baseUrl = null)
    {
        var prefix = string.IsNullOrWhiteSpace(baseUrl)
            ? string.Empty
            : baseUrl.TrimEnd('/');

        return new ItemDto
        {
            Id = item.Id.ToString(),
            Url = item.Url,
            NormalizedUrl = item.NormalizedUrl,
            Title = item.Title,
            Excerpt = item.Excerpt,
            Status = item.Status,
            IsFavorite = item.IsFavorite,
            CollectionId = item.CollectionId?.ToString(),
            Tags = tags,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt,
            PreviewImageUrl = item.PreviewImageUrl,
            ThumbnailUrl = item.ThumbnailStorageKey is null
                ? null
                : $"{prefix}/api/v1/items/{item.Id}/thumbnail",
            EnrichmentStatus = item.EnrichmentStatus,
            EnrichmentError = item.EnrichmentError,
            EnrichedAt = item.EnrichedAt
        };
    }
}
