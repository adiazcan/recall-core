using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Recall.Core.Api.Entities;

public class Collection
{
    [BsonId]
    [BsonElement("_id")]
    public ObjectId Id { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("parentId")]
    public ObjectId? ParentId { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
