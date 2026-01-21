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
    public IReadOnlyList<string> Tags { get; init; } = Array.Empty<string>();
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    public static ItemDto FromEntity(Item item)
    {
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
            Tags = item.Tags.AsReadOnly(),
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
        };
    }
}
