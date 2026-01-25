# Data Model: Bookmark Enrichment

**Feature Branch**: `005-bookmark-enrichment`  
**Created**: 2026-01-25  
**Status**: Draft

---

## Overview

This document defines the data model changes required for bookmark enrichment. The primary change is extending the existing `Item` entity with enrichment-related fields. No new persistent entities are introduced—the enrichment job is a transient message in the queue.

---

## Entity Changes

### Item (Extended)

The existing `Item` entity is extended with enrichment fields.

#### New Fields

| Field | Type | MongoDB Field | Description | Constraints |
|-------|------|---------------|-------------|-------------|
| `ThumbnailStorageKey` | `string?` | `thumbnailStorageKey` | Blob storage key for thumbnail image | Format: `{userId}/{itemId}.jpg` |
| `EnrichmentStatus` | `string` | `enrichmentStatus` | Current enrichment state | Enum: `pending`, `succeeded`, `failed` |
| `EnrichmentError` | `string?` | `enrichmentError` | Last error message if failed | Max 500 chars, sanitized |
| `EnrichedAt` | `DateTime?` | `enrichedAt` | Timestamp of last successful enrichment | UTC |

#### Updated Entity Definition

```csharp
// src/Recall.Core.Api/Entities/Item.cs
public class Item
{
    // Existing fields
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

    // NEW: Enrichment fields
    [BsonElement("thumbnailStorageKey")]
    public string? ThumbnailStorageKey { get; set; }

    [BsonElement("enrichmentStatus")]
    public string EnrichmentStatus { get; set; } = "pending";

    [BsonElement("enrichmentError")]
    public string? EnrichmentError { get; set; }

    [BsonElement("enrichedAt")]
    public DateTime? EnrichedAt { get; set; }
}
```

#### Enrichment Status Values

| Value | Description |
|-------|-------------|
| `pending` | Enrichment job queued, not yet processed |
| `succeeded` | Enrichment completed successfully |
| `failed` | Enrichment failed after all retry attempts |

---

## Indexes

### New Indexes

Add to `IndexInitializer.cs`:

```csharp
// Index for enrichment worker polling
// Allows efficient query: find pending items by userId
await itemsCollection.Indexes.CreateOneAsync(
    new CreateIndexModel<Item>(
        Builders<Item>.IndexKeys
            .Ascending(i => i.UserId)
            .Ascending(i => i.EnrichmentStatus),
        new CreateIndexOptions { Name = "idx_user_enrichment_status" }
    ),
    cancellationToken);
```

**Rationale**: While the primary flow uses a queue, this index supports:
- Re-enrichment endpoint lookups
- Admin/debug queries for enrichment status
- Potential future batch retry operations

---

## DTOs

### ItemDto (Extended)

```csharp
// src/Recall.Core.Api/Models/ItemDto.cs
public sealed record ItemDto
{
    // Existing fields...
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

    // NEW: Enrichment fields
    public string? ThumbnailUrl { get; init; }  // Derived from storage key
    public string EnrichmentStatus { get; init; } = "pending";
    public string? EnrichmentError { get; init; }
    public DateTime? EnrichedAt { get; init; }

    public static ItemDto FromEntity(Item item, string? baseUrl = null)
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
            UpdatedAt = item.UpdatedAt,
            // Enrichment fields
            ThumbnailUrl = item.ThumbnailStorageKey != null 
                ? $"{baseUrl}/api/v1/items/{item.Id}/thumbnail" 
                : null,
            EnrichmentStatus = item.EnrichmentStatus,
            EnrichmentError = item.EnrichmentError,
            EnrichedAt = item.EnrichedAt
        };
    }
}
```

---

## Queue Message Schema

### EnrichmentJob

Transient message passed via Azure Storage Queue.

```csharp
// src/Recall.Core.Api/Models/EnrichmentJob.cs (shared via common project or duplicated in Enrichment)
public sealed record EnrichmentJob
{
    /// <summary>Item ID to enrich (ObjectId string)</summary>
    public required string ItemId { get; init; }
    
    /// <summary>User ID for ownership validation</summary>
    public required string UserId { get; init; }
    
    /// <summary>URL to fetch (denormalized for convenience)</summary>
    public required string Url { get; init; }
    
    /// <summary>ISO 8601 timestamp when job was enqueued</summary>
    public required DateTime EnqueuedAt { get; init; }
}
```

**JSON Example**:
```json
{
  "itemId": "507f1f77bcf86cd799439011",
  "userId": "auth0|abc123",
  "url": "https://example.com/article",
  "enqueuedAt": "2026-01-25T10:30:00Z"
}
```

---

## Blob Storage Schema

### Thumbnail Blobs

| Aspect | Value |
|--------|-------|
| Container | `thumbnails` |
| Key Format | `{userId}/{itemId}.jpg` |
| Content-Type | `image/jpeg` |
| Max Size | ~100KB (600x400 JPEG @ 80% quality) |

**Example Key**: `auth0|abc123/507f1f77bcf86cd799439011.jpg`

**Access Control**: Blobs are not publicly accessible. Access is mediated through the API thumbnail endpoint which validates user ownership.

---

## State Transitions

### Enrichment Status State Machine

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Item Created]                                         │
│        │                                                │
│        v                                                │
│   ┌─────────┐                                           │
│   │ pending │◄────────────────────────────┐             │
│   └────┬────┘                             │             │
│        │                                  │             │
│        │ Worker picks up job              │ Re-enrich   │
│        v                                  │ requested   │
│   ┌──────────┐                            │             │
│   │processing│ (in-flight, not persisted) │             │
│   └────┬─────┘                            │             │
│        │                                  │             │
│   ┌────┴────┐                             │             │
│   │         │                             │             │
│   v         v                             │             │
│┌──────────┐ ┌────────┐                    │             │
││succeeded │ │ failed │────────────────────┘             │
│└──────────┘ └────────┘                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Notes**:
- `processing` is not a persisted state—only `pending`, `succeeded`, `failed` are stored.
- Failed items can be manually re-enqueued, returning to `pending`.
- Succeeded items can also be re-enriched (refresh scenario).

---

## Validation Rules

### Title
- Max length: 200 characters
- Sanitized: HTML entities decoded, tags stripped, whitespace normalized

### Excerpt
- Max length: 500 characters
- Sanitized: HTML entities decoded, tags stripped, whitespace normalized

### EnrichmentError
- Max length: 500 characters
- Must not contain sensitive information (stack traces, internal paths)
- User-safe error messages only

### ThumbnailStorageKey
- Format: `{userId}/{itemId}.jpg`
- Must match the item's userId for ownership validation

---

## Migration Notes

### Existing Items

Existing items created before this feature will have:
- `enrichmentStatus`: Not set (null/undefined in MongoDB)
- `title`/`excerpt`: May already be populated (user-provided)

**Strategy**: Treat missing `enrichmentStatus` as `"pending"`. A migration script or on-read defaulting can handle this:

```csharp
public string EnrichmentStatus 
{ 
    get => _enrichmentStatus ?? "pending"; 
    set => _enrichmentStatus = value; 
}
private string? _enrichmentStatus;
```

Alternatively, run a one-time migration:
```javascript
// MongoDB shell
db.items.updateMany(
  { enrichmentStatus: { $exists: false } },
  { $set: { enrichmentStatus: "pending" } }
);
```

---

## API Impact Summary

| Endpoint | Change |
|----------|--------|
| `POST /api/v1/items` | Returns `enrichmentStatus: "pending"` for new items |
| `GET /api/v1/items` | Response includes enrichment fields |
| `GET /api/v1/items/{id}` | Response includes enrichment fields |
| `GET /api/v1/items/{id}/thumbnail` | **NEW** - Returns thumbnail image |
| `POST /api/v1/items/{id}/enrich` | **NEW** - Manual re-enrichment trigger |

---

## Security Considerations

1. **Thumbnail Isolation**: Thumbnails are stored with userId prefix and served only to authenticated owners.
2. **Error Sanitization**: `enrichmentError` must not leak internal details.
3. **SSRF Protection**: URLs are validated before enrichment (see research.md).
4. **No Raw HTML Storage**: Only extracted metadata is stored, not source HTML.
