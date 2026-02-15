using System.ComponentModel.DataAnnotations;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Recall.Core.Api.Entities;

[BsonIgnoreExtraElements]
public class Tag
{
    [BsonId]
    [BsonElement("_id")]
    public ObjectId Id { get; set; }

    [BsonElement("displayName")]
    [MaxLength(50)]
    public string DisplayName { get; set; } = string.Empty;

    [BsonElement("normalizedName")]
    [MaxLength(50)]
    public string NormalizedName { get; set; } = string.Empty;

    [BsonElement("color")]
    public string? Color { get; set; }

    [BsonElement("userId")]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
