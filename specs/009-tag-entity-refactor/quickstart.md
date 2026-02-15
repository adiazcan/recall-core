# Quickstart: Tag Entity Refactor

**Spec**: 009-tag-entity-refactor | **Date**: 2026-02-15

---

## What This Feature Does

Tags are promoted from embedded strings on items to first-class entities with their own MongoDB collection. Users can create, list, rename, and delete tags independently. Items reference tags by ID instead of by name, which means renaming a tag instantly propagates to all items without updating them. A migration process converts existing embedded string tags to Tag entity references.

---

## Prerequisites

No new infrastructure or tooling required. All dependencies are already in the solution:

- .NET 10 SDK
- Aspire 13.1.0 (AppHost)
- MongoDB (via Aspire)
- Redis (via Aspire, for Dapr pub/sub)
- Dapr CLI (existing setup)
- Node.js / pnpm (for frontend)

---

## How to Verify

### 1. Start the application

```bash
cd src/Recall.Core.AppHost
dotnet run
```

### 2. Create a tag

```bash
curl -s -X POST http://localhost:5080/api/v1/tags \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"name": "JavaScript"}' | jq .
```

**Expected**: 201 Created with tag entity:
```json
{
  "id": "<objectid>",
  "displayName": "JavaScript",
  "normalizedName": "javascript",
  "color": null,
  "itemCount": 0,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 3. Create a duplicate tag (idempotent)

```bash
curl -s -X POST http://localhost:5080/api/v1/tags \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"name": "javascript"}' | jq .
```

**Expected**: 200 OK returning the existing "JavaScript" tag (same normalized name).

### 4. Create a tag with color

```bash
curl -s -X POST http://localhost:5080/api/v1/tags \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"name": "Recipes", "color": "#FF5733"}' | jq .
```

**Expected**: 201 Created with `color: "#FF5733"`.

### 5. List all tags

```bash
curl -s http://localhost:5080/api/v1/tags \
  -H "X-Test-UserId: test-user-1" | jq .
```

**Expected**: Array of tags with `itemCount` for each.

### 6. Search tags

```bash
curl -s "http://localhost:5080/api/v1/tags?q=java" \
  -H "X-Test-UserId: test-user-1" | jq .
```

**Expected**: Only tags whose normalized name starts with "java".

### 7. Save an item with tag references

```bash
TAG_ID="<id-from-step-2>"
curl -s -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d "{\"url\": \"https://developer.mozilla.org/en-US/docs/Web/JavaScript\", \"tagIds\": [\"${TAG_ID}\"]}" | jq .
```

**Expected**: 201 Created. The `tags` field shows expanded tag objects:
```json
{
  "tags": [
    { "id": "<tag-id>", "name": "JavaScript", "color": null }
  ]
}
```

### 8. Save an item with inline tag creation

```bash
curl -s -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"url": "https://reactjs.org", "newTagNames": ["React", "Frontend"]}' | jq .
```

**Expected**: 201 Created. Two new Tag entities are created, and the item references them:
```json
{
  "tags": [
    { "id": "<new-id-1>", "name": "React", "color": null },
    { "id": "<new-id-2>", "name": "Frontend", "color": null }
  ]
}
```

### 9. Rename a tag

```bash
TAG_ID="<id-from-step-2>"
curl -s -X PATCH "http://localhost:5080/api/v1/tags/${TAG_ID}" \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"name": "TypeScript"}' | jq .
```

**Expected**: 200 OK. The tag is renamed. Fetching the item from step 7 now shows `"name": "TypeScript"` — no item update needed.

### 10. Verify rename propagation

```bash
ITEM_ID="<id-from-step-7>"
curl -s "http://localhost:5080/api/v1/items/${ITEM_ID}" \
  -H "X-Test-UserId: test-user-1" | jq '.tags'
```

**Expected**: `[ { "id": "...", "name": "TypeScript", "color": null } ]`

### 11. Filter items by tag ID

```bash
TAG_ID="<id-from-step-2>"
curl -s "http://localhost:5080/api/v1/items?tagId=${TAG_ID}" \
  -H "X-Test-UserId: test-user-1" | jq '.items | length'
```

**Expected**: Only items referencing that tag.

### 12. Delete a tag

```bash
TAG_ID="<id-from-step-2>"
curl -s -X DELETE "http://localhost:5080/api/v1/tags/${TAG_ID}" \
  -H "X-Test-UserId: test-user-1" | jq .
```

**Expected**: `{ "id": "...", "itemsUpdated": 1 }`. The tag is removed and the item from step 7 no longer references it.

### 13. Verify data isolation

```bash
# User 2 cannot see user 1's tags
curl -s http://localhost:5080/api/v1/tags \
  -H "X-Test-UserId: test-user-2" | jq '.tags | length'
```

**Expected**: `0` — user 2 has no tags.

```bash
# User 2 gets 404 for user 1's tag
TAG_ID="<any-tag-from-user-1>"
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:5080/api/v1/tags/${TAG_ID}" \
  -H "X-Test-UserId: test-user-2"
```

**Expected**: `404`

---

## Run Migration (after deploying with existing data)

```bash
cd src/Recall.Core.Api
dotnet run -- migrate-tags --export-path ./migration-export.json
```

**Expected output**:
```
Migration complete.
  Items processed: 150
  Tags created: 42
  Duplicates merged: 8
  Items updated: 145
  Items skipped: 5
  Errors: 0
  Export: ./migration-export.json
```

### Dry run (no writes)

```bash
dotnet run -- migrate-tags --dry-run
```

### Rollback

```bash
dotnet run -- migrate-tags --rollback --import-path ./migration-export.json
```

---

## Run Tests

```bash
# Backend integration tests
cd src/tests/Recall.Core.Api.Tests
dotnet test

# Frontend unit tests
cd src/web
pnpm test
```

---

## Key Architecture Changes

| Before (v1.2.0) | After (v1.3.0) |
|---|---|
| `Item.Tags = List<string>` | `Item.TagIds = List<ObjectId>` + new `Tag` entity |
| Tag operations via `$unwind/$group` on items | `ITagRepository` with dedicated `tags` collection |
| PATCH/DELETE `/tags/{name}` | Full CRUD `/tags`, `/tags/{id}` by ID |
| `CreateItemRequest.Tags: string[]` | `CreateItemRequest.TagIds + NewTagNames` |
| `ItemDto.Tags: string[]` | `ItemDto.Tags: TagSummary[]` (id, name, color) |
| Rename updates all items via `updateMany` | Rename updates only the Tag document |
| No tag metadata (color) | `color` field on Tag entity |

---

## New/Modified Files

### Backend
```
src/Recall.Core.Api/
├── Entities/Tag.cs                    # NEW — Tag entity
├── Entities/Item.cs                   # MODIFIED — add TagIds field
├── Endpoints/TagsEndpoints.cs         # REWRITTEN — ID-based CRUD
├── Endpoints/ItemsEndpoints.cs        # MODIFIED — tagIds + newTagNames
├── Models/TagDto.cs                   # MODIFIED — full tag DTO
├── Models/CreateTagRequest.cs         # NEW
├── Models/UpdateTagRequest.cs         # NEW
├── Repositories/ITagRepository.cs     # NEW
├── Repositories/TagRepository.cs      # NEW
├── Services/ITagService.cs            # NEW
├── Services/TagService.cs             # NEW
├── Services/TagNormalizer.cs          # NEW
├── Services/ItemService.cs            # MODIFIED — tag resolution
└── Migration/TagMigrationService.cs   # NEW
```

### Frontend
```
src/web/src/
├── types/entities.ts                  # MODIFIED — Tag/Item types
├── lib/api/tags.ts                    # REWRITTEN — ID-based API
├── lib/api/items.ts                   # MODIFIED — tagIds + newTagNames
├── features/tags/store.ts             # REWRITTEN
├── features/tags/components/TagPicker.tsx      # NEW
├── features/tags/components/TagManagement.tsx  # NEW
├── features/tags/hooks/useTagSearch.ts         # NEW
└── pages/TagManagementPage.tsx                 # NEW
```
