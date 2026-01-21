using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Models;

public sealed record CollectionDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? ParentId { get; init; }
    public int ItemCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    public static CollectionDto FromEntity(Collection collection, int itemCount)
    {
        return new CollectionDto
        {
            Id = collection.Id.ToString(),
            Name = collection.Name,
            Description = collection.Description,
            ParentId = collection.ParentId?.ToString(),
            ItemCount = itemCount,
            CreatedAt = collection.CreatedAt,
            UpdatedAt = collection.UpdatedAt
        };
    }
}