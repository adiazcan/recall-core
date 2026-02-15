# Research: Tag Entity Refactor

**Spec**: 009-tag-entity-refactor | **Date**: 2026-02-15

---

## 1. Tag Normalization Strategy

### Decision: `Trim().ToLowerInvariant()` — same as current tag normalization, no diacritics removal

**Rationale**: The existing codebase normalizes tags via `tag.Trim().ToLowerInvariant()` in `ItemService.NormalizeTags()`. Diacritics removal (e.g., `café` → `cafe`) would change the semantics of tag matching and break existing tag data during migration. The spec does not require diacritics normalization — it specifies "lowercase" only (FR-001 says "normalized name (lowercase)"). Keeping the same normalization logic ensures migration produces identical normalized names to what items already have.

The `TagNormalizer` utility centralizes this logic so both the Tag service and migration use the same function:

```csharp
public static class TagNormalizer
{
    public static string Normalize(string displayName)
    {
        var trimmed = displayName.Trim();
        if (trimmed.Length == 0)
            throw new ArgumentException("Tag name cannot be empty.");
        if (trimmed.Length > 50)
            throw new ArgumentException("Tag name must be 50 characters or fewer.");
        return trimmed.ToLowerInvariant();
    }
}
```

**Alternatives considered**:
- Diacritics removal (`string.Normalize(NormalizationForm.FormD)` + regex strip) — rejected because existing tag data uses `ToLowerInvariant()` only, and migration would create mismatches.
- Case-insensitive collation in MongoDB — rejected because it requires a collation-aware index which is less explicit than storing the normalized form.

---

## 2. MongoDB Unique Constraint for Concurrent Tag Creation

### Decision: Unique compound index `{ userId: 1, normalizedName: 1 }` + catch `DuplicateKey` and return existing

**Rationale**: The spec requires handling concurrent creation of the same tag (edge case: "two concurrent requests attempt to create the same tag"). MongoDB's unique index on `(userId, normalizedName)` naturally prevents duplicates. The repository handles `MongoWriteException` with `DuplicateKey` category by querying for the existing tag and returning it — the same pattern used by `ItemService.SaveItemAsync` for URL deduplication.

```csharp
public async Task<Tag> CreateAsync(string userId, Tag tag, CancellationToken ct = default)
{
    tag.UserId = userId;
    try
    {
        await _collection.InsertOneAsync(tag, cancellationToken: ct);
        return tag;
    }
    catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
    {
        var existing = await _collection.Find(
            t => t.UserId == userId && t.NormalizedName == tag.NormalizedName)
            .FirstOrDefaultAsync(ct);
        if (existing is not null)
            return existing;
        throw;
    }
}
```

**Index creation**: Created during app startup in an `IndexInitializer` (consistent with existing index patterns mentioned in copilot-instructions.md):

```csharp
// tags collection indexes
{ userId: 1, normalizedName: 1 } — unique
{ userId: 1, createdAt: -1 }     — for listing sorted by creation
```

**Alternatives considered**:
- MongoDB `findOneAndUpdate` with `upsert: true` — rejected because it requires building update definitions that handle all fields, and upsert semantics are more complex for a create operation.
- Application-level lock — rejected because it doesn't work across multiple API instances.

---

## 3. Batch Tag Expansion (Avoiding N+1)

### Decision: Single `$in` query to load all tags for a page of items, then join in memory

**Rationale**: When listing items, each item has `tagIds: ObjectId[]`. Instead of loading tags per-item (N+1), collect all unique tag IDs across the page of items, issue a single `Find({ _id: { $in: [...] } })` to the `tags` collection, build a dictionary, then map `tagIds` → `TagDto[]` in memory.

```csharp
// In ItemService.ListItemsAsync:
var items = await repository.ListAsync(query, ct);
var allTagIds = items.SelectMany(i => i.TagIds).Distinct().ToList();
var tags = await tagRepository.GetByIdsAsync(userId, allTagIds, ct);
var tagMap = tags.ToDictionary(t => t.Id);

var dtos = items.Select(item => ItemDto.FromEntity(item, 
    item.TagIds.Select(id => tagMap.GetValueOrDefault(id))
              .Where(t => t is not null)
              .Select(t => TagDto.FromEntity(t!))
              .ToList()
)).ToList();
```

This pattern:
- Issues exactly 2 MongoDB queries per list request (items + tags), regardless of page size
- Handles missing tags gracefully (deleted between listing and lookup — silently omitted)
- Is consistent with the constitution's N+1 prohibition

**Alternatives considered**:
- MongoDB `$lookup` aggregation (server-side join) — rejected because it adds complexity to the aggregation pipeline and doesn't work well with cursor pagination already in use.
- Embed tag snapshots on items — rejected because it would require updating all items when a tag is renamed, which is the exact problem we're solving.

---

## 4. Tag Deletion Cascading

### Decision: `$pull` tagId from all items, then delete the tag document

**Rationale**: When a user deletes a tag (FR-005), the system must remove all references from their items. This uses MongoDB's `$pull` operator on the `tagIds` array, followed by deleting the tag document. Both operations filter by `userId` for data isolation.

```csharp
public async Task<long> DeleteTagAsync(string userId, ObjectId tagId, CancellationToken ct)
{
    // 1. Remove tag reference from all items
    var filter = Builders<Item>.Filter.And(
        Builders<Item>.Filter.Eq(i => i.UserId, userId),
        Builders<Item>.Filter.AnyEq(i => i.TagIds, tagId));
    var update = Builders<Item>.Update.Pull(i => i.TagIds, tagId);
    var result = await _itemsCollection.UpdateManyAsync(filter, update, cancellationToken: ct);
    
    // 2. Delete the tag
    await _tagsCollection.DeleteOneAsync(
        t => t.Id == tagId && t.UserId == userId, cancellationToken: ct);
    
    return result.ModifiedCount;
}
```

This approach:
- Is consistent with the existing `DeleteTagAsync` pattern in `ItemRepository` (uses `$pull`)
- Runs in two operations (not transactional) — acceptable because partial failure is safe: items with a dangling tagId are handled gracefully on read (unknown tags are omitted from expansion)
- Returns `ModifiedCount` for the response

**Alternatives considered**:
- MongoDB multi-document transaction — rejected because it's unnecessary overhead for this use case, and partial failure is handled gracefully.
- Soft delete (archive) — explicitly out of scope per spec.

---

## 5. Migration Architecture

### Decision: Cursor-based batch migration with JSON export, idempotent via `tagIds` presence check

**Rationale**: The migration scans items that have legacy `tags: string[]` populated but no `tagIds` (or `tagIds` is empty). For each batch:

1. Read a batch of items (e.g., 100) with `tags.length > 0 && (tagIds == null || tagIds.length == 0)`
2. Collect all unique `(userId, normalizedTag)` pairs from the batch
3. Upsert tags into the `tags` collection using `FindOneAndUpdate` with `upsert: true` — if the tag exists, return it; if not, create it with the display name from the first occurrence
4. Map each item's `tags[]` → `tagIds[]` using the upserted tag IDs
5. Update each item's `tagIds` field
6. Export the mapping to a JSON file for rollback

**Idempotency**: Items already migrated (have `tagIds` populated) are skipped by the query filter. Re-running produces no changes.

**Export format** (for rollback):

```json
{
  "migratedAt": "2026-02-15T12:00:00Z",
  "users": {
    "user-1": {
      "tagMapping": {
        "javascript": "tag-objectid-1",
        "recipes": "tag-objectid-2"
      },
      "items": [
        { "itemId": "item-objectid-1", "originalTags": ["javascript", "recipes"], "tagIds": ["tag-objectid-1", "tag-objectid-2"] }
      ]
    }
  },
  "metrics": {
    "itemsProcessed": 150,
    "tagsCreated": 42,
    "duplicatesMerged": 8,
    "itemsUpdated": 145,
    "itemsSkipped": 5,
    "errors": 0
  }
}
```

**Rollback**: Restore `tags[]` from `originalTags` in the export and clear `tagIds`. This is a separate script/command that reads the export file.

**Implementation location**: `src/Recall.Core.Api/Migration/TagMigrationService.cs` — invoked via a CLI command (`dotnet run -- migrate-tags`) or a protected admin endpoint. Not a background service — it runs once on demand.

**Alternatives considered**:
- Change stream-based live migration — rejected because the spec explicitly states the migration can run offline/maintenance window.
- MongoDB aggregation pipeline with `$merge` — rejected because it doesn't support the complex upsert + mapping logic needed.

---

## 6. Item API Transition

### Decision: Replace `tags: string[]` with `tagIds: string[]` + `newTagNames: string[]` on requests, return expanded `tags: TagDto[]` on responses

**Rationale**: The spec (Clarifications section) says "Replace in place — remove old name-based endpoints, introduce ID-based endpoints under the same `/api/v1/tags` path, deployed alongside the migration."

### Request changes

**`CreateItemRequest`**:
```csharp
public sealed record CreateItemRequest(
    string Url,
    string? Title = null,
    IReadOnlyList<string>? TagIds = null,        // existing tag IDs
    IReadOnlyList<string>? NewTagNames = null     // names for inline create
);
```

**`UpdateItemRequest`**:
```csharp
public sealed record UpdateItemRequest(
    string? Title = null,
    string? Excerpt = null,
    string? Status = null,
    bool? IsFavorite = null,
    string? CollectionId = null,
    IReadOnlyList<string>? TagIds = null,        // replaces entire tag list
    IReadOnlyList<string>? NewTagNames = null     // names for inline create
);
```

The old `Tags: IReadOnlyList<string>?` field is removed from both request types.

### Response changes

**`ItemDto`** changes `tags` from `IReadOnlyList<string>` to `IReadOnlyList<TagSummaryDto>`:

```csharp
public sealed record TagSummaryDto(string Id, string Name, string? Color);
```

This keeps the JSON property name `tags` for minimal frontend disruption, but changes the shape from `["tag1", "tag2"]` to `[{ "id": "...", "name": "Tag 1", "color": null }, ...]`.

### Processing flow

On create/update:
1. Validate `tagIds` — each must be a valid ObjectId belonging to the user
2. Process `newTagNames` — normalize each, check if tag exists by `(userId, normalizedName)`, create if not
3. Combine validated tag IDs + newly created tag IDs (deduplicate)
4. Enforce max 50 tags per item
5. Store `tagIds` on the item

**Alternatives considered**:
- Keep `tags: string[]` for backward compatibility with a feature flag — rejected because the spec says single-release replacement with no dual-endpoint period.
- Return `tagIds` as raw IDs + separate `tags` expanded — rejected in favor of a single `tags` field with full tag objects (simpler for frontend).

---

## 7. Frontend Tag Picker Pattern

### Decision: Debounced search with `useTagSearch` hook + `TagPicker` component using existing Zustand patterns

**Rationale**: The tag picker needs to: search existing tags (debounced API call), display suggestions, allow selection, and allow inline creation of new tags. Following existing Zustand patterns:

```typescript
// features/tags/hooks/useTagSearch.ts
export function useTagSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tag[]>([]);
  
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const tags = await tagsApi.list({ q: query });
      setResults(tags);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);
  
  return { query, setQuery, results };
}
```

The `TagPicker` component:
- Renders an input with dropdown suggestions
- Shows matching existing tags as selectable chips
- Shows "Create 'xyz'" option when no exact match found
- Calls `tagsApi.create()` for inline creation
- Manages selected tags as `Tag[]` (with IDs)

Following constitution: Tailwind for styling, no arbitrary values, keyboard accessible (arrow keys + Enter for selection), WCAG 2.1 AA.

**Alternatives considered**:
- Full-text search via MongoDB `$text` index — overkill for tag names; simple `$regex` prefix match on `normalizedName` is sufficient and keeps implementation simple.
- Third-party autocomplete library — rejected per constitution (no new dependencies without precedent).

---

## 8. Tag Listing with Item Counts

### Decision: Aggregation pipeline on `items` collection grouped by `tagId`, joined with `tags` collection data

**Rationale**: FR-006 requires listing tags with item counts. Instead of maintaining a denormalized count on the Tag entity (which requires updating on every item change), compute counts on demand:

```
// Aggregation pipeline
db.items.aggregate([
  { $match: { userId: "user-1" } },
  { $unwind: "$tagIds" },
  { $group: { _id: "$tagIds", count: { $sum: 1 } } }
])
```

Then join with tag documents in application code (fetch all user's tags, merge counts). This is the exact same pattern currently used by `ItemRepository.GetAllTagsWithCountsAsync()` — it just operates on `tagIds` instead of `tags`.

For use cases where the user has many tags but wants a paginated list, the tag listing endpoint supports:
- `q` parameter for prefix search on `normalizedName`
- Cursor pagination (alphabetical by `normalizedName`)
- Item counts computed per page via the aggregation

**Performance**: For a typical user with <100 tags, this is fast (<50ms). For users with thousands of tags, the `q` search filter limits the result set. The `(userId, tagIds)` index on items enables efficient `$unwind` + `$group`.

**Alternatives considered**:
- Denormalized `itemCount` on Tag entity — rejected because it requires updating the count atomically on every item create/update/delete that touches tags, adding complexity and risk of count drift.
- MongoDB `$lookup` join — rejected because it requires the `items` collection as the starting point anyway for counting.

---

## 9. Items Collection Index Changes

### Decision: Add multikey index on `tagIds`, keep `tags` index during migration

**Rationale**: The current `{ tags: 1 }` multikey index supports tag-based item filtering. After migration:

New indexes:
```
{ userId: 1, tagIds: 1 }  — multikey index for filtering items by tag ID
```

The old `{ tags: 1 }` index is kept during the migration period (items may still have the legacy field) and dropped after migration is confirmed complete.

**Alternatives considered**:
- Compound index `{ userId: 1, tagIds: 1, createdAt: -1 }` — rejected because the existing cursor pagination already uses `{ userId: 1, createdAt: -1, _id: -1 }` and adding `tagIds` to that compound index would make it overly wide.

---

## 10. Tag Rename Propagation

### Decision: Rename updates only the Tag document — no item updates needed

**Rationale**: This is the primary advantage of the tag-entity-reference model. When a tag is renamed:

1. Update the Tag document's `displayName` and `normalizedName`
2. Validate the new `normalizedName` doesn't conflict with another tag for the same user
3. Items store `tagIds` (ObjectId references) — they don't store tag names, so no item updates are needed

The rename propagates immediately because item reads expand `tagIds` into full tag details from the `tags` collection. This directly satisfies SC-003: "Tag renaming propagates to all associated items."

**Alternatives considered**:
- Store tag name on items as a cache — rejected because it would require updating all items on rename, which is the problem we're solving.

---

## Summary of Key Decisions

| Topic | Decision |
|-------|----------|
| Normalization | `Trim().ToLowerInvariant()` — same as current |
| Uniqueness | Compound unique index `(userId, normalizedName)` + catch DuplicateKey |
| Tag expansion | Batch `$in` query per page — 2 queries per list (items + tags) |
| Tag deletion | `$pull` tagId from items, then delete tag document |
| Migration | Cursor-based batch, upsert, JSON export for rollback |
| API transition | Replace in place — `tagIds` + `newTagNames` on requests, expanded `tags: TagDto[]` on responses |
| Tag picker | Debounced search hook + `TagPicker` component, Zustand store |
| Item counts | Aggregation on `items` collection (existing pattern) |
| Index changes | New `{ userId: 1, tagIds: 1 }`, keep `{ tags: 1 }` during migration |
| Rename propagation | Update Tag document only — items reference by ID |
