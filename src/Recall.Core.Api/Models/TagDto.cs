using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Models;

public sealed record TagDto
{
    public string Id { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string NormalizedName { get; init; } = string.Empty;
    public string? Color { get; init; }
    public int ItemCount { get; init; }
    public string CreatedAt { get; init; } = string.Empty;
    public string UpdatedAt { get; init; } = string.Empty;

    public static TagDto FromEntity(Tag tag, int itemCount = 0)
    {
        ArgumentNullException.ThrowIfNull(tag);

        return new TagDto
        {
            Id = tag.Id.ToString(),
            DisplayName = tag.DisplayName,
            NormalizedName = tag.NormalizedName,
            Color = tag.Color,
            ItemCount = itemCount,
            CreatedAt = tag.CreatedAt.ToUniversalTime().ToString("O"),
            UpdatedAt = tag.UpdatedAt.ToUniversalTime().ToString("O")
        };
    }
}

public sealed record TagListResponse
{
    public IReadOnlyList<TagDto> Tags { get; init; } = Array.Empty<TagDto>();
    public string? NextCursor { get; init; }
    public bool HasMore { get; init; }
}

public sealed record TagSummaryDto(string Id, string Name, string? Color);

public sealed record TagDeleteResponse(string Id, long ItemsUpdated);
