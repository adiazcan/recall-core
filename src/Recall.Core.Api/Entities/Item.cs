using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Recall.Core.Api.Entities;

public class Item
{
    [BsonId]
    [BsonElement("_id")]
    public ObjectId Id { get; set; }

    [BsonElement("url")]
    public string Url { get; set; } = string.Empty;

    [BsonElement("normalizedUrl")]
    public string NormalizedUrl { get; set; } = string.Empty;

    [BsonElement("title")]
    public string? Title { get; set; }

    [BsonElement("excerpt")]
    public string? Excerpt { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "unread";

    [BsonElement("isFavorite")]
    public bool IsFavorite { get; set; }

    [BsonElement("collectionId")]
    public ObjectId? CollectionId { get; set; }

    [BsonElement("tags")]
    public List<string> Tags { get; set; } = [];

    [BsonElement("userId")]
    public string? UserId { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    [BsonElement("previewImageUrl")]
    public string? PreviewImageUrl { get; set; }

    [BsonElement("thumbnailStorageKey")]
    public string? ThumbnailStorageKey { get; set; }

    [BsonElement("enrichmentStatus")]
    public string EnrichmentStatus { get; set; } = "pending";

    [BsonElement("enrichmentError")]
    public string? EnrichmentError { get; set; }

    [BsonElement("enrichedAt")]
    public DateTime? EnrichedAt { get; set; }
}
