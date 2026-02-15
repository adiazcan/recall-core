# Data Model: Tag Entity Refactor

**Spec**: 009-tag-entity-refactor | **Date**: 2026-02-15

---

## Overview

This feature introduces a **first-class Tag entity** stored in its own MongoDB collection, and modifies the **Item entity** to reference tags by ObjectId (`tagIds`) instead of embedding string names (`tags`). The migration converts existing embedded tags to Tag entity references.

Two entity changes:
1. **New**: `Tag` entity in a `tags` collection
2. **Modified**: `Item` entity — adds `tagIds: ObjectId[]`, legacy `tags: string[]` kept temporarily for migration

---

## Tag Entity (new)

> Location: `src/Recall.Core.Api/Entities/Tag.cs`

| Field | C# Type | MongoDB Field | BSON Type | Notes |
|---|---|---|---|---|
| `Id` | `ObjectId` | `_id` | `ObjectId` | Auto-generated |
| `DisplayName` | `string` | `displayName` | `string` | User-entered name, 1–50 chars, trimmed |
| `NormalizedName` | `string` | `normalizedName` | `string` | `Trim().ToLowerInvariant()` of display name |
| `Color` | `string?` | `color` | `string` / `null` | Optional hex color (e.g., `#FF5733`), nullable |
| `UserId` | `string` | `userId` | `string` | Owner — set on insert, never changes |
| `CreatedAt` | `DateTime` | `createdAt` | `DateTime` | UTC |
| `UpdatedAt` | `DateTime` | `updatedAt` | `DateTime` | UTC |

### C# Entity

```csharp
[BsonIgnoreExtraElements]
public class Tag
{
    [BsonId]
    [BsonElement("_id")]
    public ObjectId Id { get; set; }

    [BsonElement("displayName")]
    public string DisplayName { get; set; } = string.Empty;

    [BsonElement("normalizedName")]
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
```

### Indexes

| Index | Fields | Properties | Purpose |
|---|---|---|---|
| Uniqueness | `{ userId: 1, normalizedName: 1 }` | Unique | Enforce one tag per normalized name per user |
| Listing | `{ userId: 1, normalizedName: 1 }` | (same as above) | Alphabetical listing supports cursor pagination |

The unique index serves double duty — it enforces uniqueness and supports efficient alphabetical queries filtered by `userId`.

### Validation Rules

- `DisplayName`: Required, 1–50 characters after trimming. Leading/trailing whitespace stripped.
- `NormalizedName`: Computed from `DisplayName` via `TagNormalizer.Normalize()` — `Trim().ToLowerInvariant()`. Never set directly by API consumer.
- `Color`: Optional. If provided, must be a valid 7-character hex color string (e.g., `#FF5733`). Validated on create/update.
- `UserId`: Set automatically from authenticated user context. Immutable after creation.

---

## Item Entity (modified — two field changes)

> Location: `src/Recall.Core.Api/Entities/Item.cs`

| Field | C# Type | MongoDB Field | Notes |
|---|---|---|---|
| `Id` | `ObjectId` | `_id` | Auto-generated |
| `Url` | `string` | `url` | Original URL |
| `NormalizedUrl` | `string` | `normalizedUrl` | For deduplication |
| `Title` | `string?` | `title` | User-provided or sync-enriched |
| `Excerpt` | `string?` | `excerpt` | User-provided or sync-enriched |
| `Status` | `string` | `status` | `unread` / `archived` |
| `IsFavorite` | `bool` | `isFavorite` | |
| `CollectionId` | `ObjectId?` | `collectionId` | Nullable FK |
| ~~`Tags`~~ | ~~`List<string>`~~ | ~~`tags`~~ | **LEGACY — kept for migration, removed after** |
| **`TagIds`** | **`List<ObjectId>`** | **`tagIds`** | **NEW — references to Tag entities** |
| `UserId` | `string?` | `userId` | Set on insert |
| `CreatedAt` | `DateTime` | `createdAt` | UTC |
| `UpdatedAt` | `DateTime` | `updatedAt` | UTC |
| `PreviewImageUrl` | `string?` | `previewImageUrl` | og:image URL |
| `ThumbnailStorageKey` | `string?` | `thumbnailStorageKey` | Blob key |
| `EnrichmentStatus` | `string` | `enrichmentStatus` | `pending` / `succeeded` / `failed` |
| `EnrichmentError` | `string?` | `enrichmentError` | Max 500 chars |
| `EnrichedAt` | `DateTime?` | `enrichedAt` | UTC |

### New Field: `TagIds`

```csharp
[BsonElement("tagIds")]
public List<ObjectId> TagIds { get; set; } = [];
```

- **Source**: Set on item create/update from validated tag IDs + inline-created tag IDs.
- **Max count**: 50 (validated on write — FR-013).
- **Relationship**: Many-to-many with Tag entities. An item can reference multiple tags; a tag can be referenced by multiple items.
- **On tag deletion**: The tag's ObjectId is `$pull`ed from all referencing items' `tagIds` arrays.
- **On read**: Tag IDs are expanded to `TagSummaryDto` (id, name, color) via batch lookup.

### Legacy Field: `Tags`

```csharp
[BsonElement("tags")]
public List<string> Tags { get; set; } = [];
```

- **Kept temporarily** during migration to preserve existing data.
- **Not written** by the new API — only `tagIds` is used for new operations.
- **Read** only by the migration service to build the tag mapping.
- **Removed** after migration is confirmed complete and rollback window has passed.

### Index Changes

| Action | Index | Purpose |
|---|---|---|
| **Add** | `{ userId: 1, tagIds: 1 }` | Multikey index for filtering items by tag ID |
| **Keep** (during migration) | `{ tags: 1 }` | Legacy tag filtering — drop after migration complete |
| **Keep** | `{ userId: 1, normalizedUrl: 1 }` unique | URL deduplication |
| **Keep** | `{ userId: 1, createdAt: -1, _id: -1 }` | Cursor pagination |

---

## TagNormalizer Utility

> Location: `src/Recall.Core.Api/Services/TagNormalizer.cs`

Centralizes tag name normalization used by both the Tag service and migration:

```csharp
public static class TagNormalizer
{
    public const int MaxLength = 50;

    public static string Normalize(string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
            throw new ArgumentException("Tag name cannot be empty.", nameof(displayName));

        var trimmed = displayName.Trim();
        if (trimmed.Length > MaxLength)
            throw new ArgumentException($"Tag name must be {MaxLength} characters or fewer.", nameof(displayName));

        return trimmed.ToLowerInvariant();
    }
}
```

**Same logic** as the existing `NormalizeTags()` in `ItemService` — extracted to a shared utility for consistency.

---

## DTOs (API layer)

### TagDto (full tag for management endpoints)

```csharp
public sealed record TagDto(
    string Id,
    string DisplayName,
    string NormalizedName,
    string? Color,
    int ItemCount,
    string CreatedAt,
    string UpdatedAt);
```

Returned by `GET /api/v1/tags` and `GET /api/v1/tags/{id}`.

### TagSummaryDto (embedded in ItemDto)

```csharp
public sealed record TagSummaryDto(
    string Id,
    string Name,
    string? Color);
```

Returned in `ItemDto.Tags` when reading items — lightweight, contains only what the UI needs for display.

### CreateTagRequest

```csharp
public sealed record CreateTagRequest(
    string Name,
    string? Color = null);
```

### UpdateTagRequest

```csharp
public sealed record UpdateTagRequest(
    string? Name = null,
    string? Color = null);
```

### CreateItemRequest (modified)

```csharp
public sealed record CreateItemRequest(
    string Url,
    string? Title = null,
    IReadOnlyList<string>? TagIds = null,
    IReadOnlyList<string>? NewTagNames = null);
```

Old `Tags: IReadOnlyList<string>?` field removed. Replaced by `TagIds` (existing tag IDs) and `NewTagNames` (names for inline creation).

### UpdateItemRequest (modified)

```csharp
public sealed record UpdateItemRequest(
    string? Title = null,
    string? Excerpt = null,
    string? Status = null,
    bool? IsFavorite = null,
    string? CollectionId = null,
    IReadOnlyList<string>? TagIds = null,
    IReadOnlyList<string>? NewTagNames = null);
```

Old `Tags: IReadOnlyList<string>?` field removed.

### ItemDto (modified tags field)

The `Tags` property changes from `IReadOnlyList<string>` to `IReadOnlyList<TagSummaryDto>`:

```csharp
// Before
public IReadOnlyList<string> Tags { get; init; } = [];

// After
public IReadOnlyList<TagSummaryDto> Tags { get; init; } = [];
```

---

## Repository Interfaces

### ITagRepository (new)

```csharp
public interface ITagRepository
{
    Task<Tag> CreateAsync(string userId, Tag tag, CancellationToken ct = default);
    Task<Tag?> GetByIdAsync(string userId, ObjectId id, CancellationToken ct = default);
    Task<Tag?> GetByNormalizedNameAsync(string userId, string normalizedName, CancellationToken ct = default);
    Task<IReadOnlyList<Tag>> GetByIdsAsync(string userId, IEnumerable<ObjectId> ids, CancellationToken ct = default);
    Task<IReadOnlyList<Tag>> ListAsync(string userId, string? query, string? cursor, int limit, CancellationToken ct = default);
    Task<Tag?> UpdateAsync(string userId, ObjectId id, UpdateDefinition<Tag> update, CancellationToken ct = default);
    Task<long> DeleteAsync(string userId, ObjectId id, CancellationToken ct = default);
}
```

### IItemRepository (modified)

Added methods:
```csharp
Task<IReadOnlyList<TagIdCount>> GetTagIdCountsAsync(string userId, CancellationToken ct = default);
Task<long> RemoveTagIdFromItemsAsync(string userId, ObjectId tagId, CancellationToken ct = default);
```

Modified `ItemListQuery` — the `Tag` field (string) changes to `TagId` (ObjectId?):
```csharp
public sealed record ItemListQuery(
    string UserId, string? Status, ObjectId? CollectionId,
    bool InboxOnly, ObjectId? TagId, bool? IsFavorite,
    string? EnrichmentStatus, ObjectId? CursorId,
    DateTime? CursorCreatedAt, int Limit);

public sealed record TagIdCount(ObjectId TagId, int Count);
```

---

## Migration Data Flow

```
[Items with tags: string[]]
        │
        ▼
  Migration Service
        │
        ├── For each user's items:
        │     1. Read batch of items where tags.length > 0 && tagIds is empty
        │     2. Normalize each tag string
        │     3. Upsert Tag entity (by userId + normalizedName)
        │     4. Map tag strings → tag ObjectIds
        │     5. Set item.tagIds = mapped ObjectIds
        │     6. Log progress
        │
        ├── Export mapping to JSON file
        │
        └── Record metrics (items, tags created, duplicates merged)

[Rollback]
        │
        ▼
  Read export JSON → Restore items.tags from originalTags → Clear items.tagIds
```

### State transitions during migration

| Item State | tags | tagIds | Migration Action |
|---|---|---|---|
| Pre-migration | `["js", "tutorial"]` | `[]` | Normalize → upsert Tag entities → set `tagIds` |
| Post-migration | `["js", "tutorial"]` (kept) | `[ObjectId1, ObjectId2]` | None — already migrated |
| No tags | `[]` | `[]` | None — skipped |
| Post-rollback | `["js", "tutorial"]` (restored) | `[]` (cleared) | Reversed |

---

## Frontend Types

### Tag (modified)

```typescript
// Before
export interface Tag { name: string; count: number; color?: string; }

// After
export interface Tag {
  id: string;
  displayName: string;
  normalizedName: string;
  color: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### TagSummary (new — embedded in Item)

```typescript
export interface TagSummary {
  id: string;
  name: string;
  color: string | null;
}
```

### Item (modified)

```typescript
// Before
export interface Item {
  // ...
  tags: string[];
}

// After
export interface Item {
  // ...
  tags: TagSummary[];
}
```
