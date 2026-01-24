# Data Model: Microsoft Entra External ID Authentication

**Feature**: 004-entra-external-auth  
**Date**: 2026-01-24

## Overview

This feature extends existing entities with user ownership (`userId` field) to enable per-user data isolation. No new entities are introduced; existing Item and Collection entities are modified. Tags remain embedded within Items (no separate collection).

## Entity Changes

### Item (Modified)

The Item entity is extended with a `userId` field to scope ownership to the authenticated user.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | ObjectId | Auto | MongoDB document ID |
| `url` | string | Yes | Original URL (max 2048 chars) |
| `normalizedUrl` | string | Yes | Canonicalized URL for deduplication |
| `title` | string | No | User-provided or extracted title (max 500 chars) |
| `excerpt` | string | No | User-provided or extracted description (max 1000 chars) |
| `status` | string | Yes | Item state: `"unread"` or `"archived"` |
| `isFavorite` | boolean | Yes | Favorite flag, default `false` |
| `collectionId` | ObjectId | No | Reference to Collection; `null` = inbox |
| `tags` | string[] | Yes | Lowercase-normalized tag labels |
| `createdAt` | DateTime | Yes | UTC timestamp when item was saved |
| `updatedAt` | DateTime | Yes | UTC timestamp of last modification |
| **`userId`** | **string** | **Yes*** | **NEW: Owning user's identifier (from `sub` claim)** |

*Required for new records; existing records without `userId` are orphaned (inaccessible).

**C# Entity Change**:
```csharp
// Add to Item.cs
[BsonElement("userId")]
public string? UserId { get; set; }
```

**Validation Rules** (additions):
- `userId`: Must be a non-empty string matching the authenticated user's `sub` claim
- `normalizedUrl`: Unique constraint now scoped per user (`userId` + `normalizedUrl`)

**Indexes** (replace existing):
```javascript
// Previous: { "normalizedUrl": 1 } unique
// New: Scoped uniqueness per user
{ "userId": 1, "normalizedUrl": 1 }  // unique compound for deduplication

// Previous: { "createdAt": -1, "_id": -1 }
// New: Prefixed with userId for efficient per-user pagination
{ "userId": 1, "createdAt": -1, "_id": -1 }

// Previous: { "status": 1, "createdAt": -1 }
// New: Prefixed with userId
{ "userId": 1, "status": 1, "createdAt": -1 }

// Previous: { "collectionId": 1, "createdAt": -1 }
// New: Prefixed with userId
{ "userId": 1, "collectionId": 1, "createdAt": -1 }

// Previous: { "tags": 1 }
// New: Prefixed with userId for tag filtering
{ "userId": 1, "tags": 1 }
```

---

### Collection (Modified)

The Collection entity is extended with a `userId` field to scope ownership.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | ObjectId | Auto | MongoDB document ID |
| `name` | string | Yes | Collection name (max 100 chars) |
| `description` | string | No | Optional description (max 500 chars) |
| `parentId` | ObjectId | No | Parent collection for hierarchy; `null` = root |
| `createdAt` | DateTime | Yes | UTC timestamp when created |
| `updatedAt` | DateTime | Yes | UTC timestamp of last modification |
| **`userId`** | **string** | **Yes*** | **NEW: Owning user's identifier (from `sub` claim)** |

*Required for new records; existing records without `userId` are orphaned.

**C# Entity Change**:
```csharp
// Add to Collection.cs
[BsonElement("userId")]
public string? UserId { get; set; }
```

**Validation Rules** (additions):
- `userId`: Must be a non-empty string matching the authenticated user's `sub` claim
- `name`: Unique constraint now scoped per user (`userId` + `name`)
- `parentId`: Must reference a collection owned by the same user

**Indexes** (replace existing):
```javascript
// Previous: { "name": 1 } unique
// New: Scoped uniqueness per user
{ "userId": 1, "name": 1 }  // unique compound

// Previous: { "parentId": 1 }
// New: Prefixed with userId for hierarchy queries
{ "userId": 1, "parentId": 1 }
```

---

### Tag (Embedded - No Change)

Tags remain embedded as string arrays within Item documents. No separate collection change required.

**Tag Queries** (modified):
All tag aggregation queries must filter by `userId` first:

```javascript
// List all tags with counts for a user
db.items.aggregate([
  { $match: { userId: "user-sub-id" } },
  { $unwind: "$tags" },
  { $group: { _id: "$tags", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// Rename tag globally for a user
db.items.updateMany(
  { userId: "user-sub-id", tags: "old-tag" },
  { $set: { "tags.$": "new-tag" } }
)

// Delete tag (detach) for a user
db.items.updateMany(
  { userId: "user-sub-id" },
  { $pull: { tags: "tag-to-delete" } }
)
```

---

## New Response Model: UserInfo

Response model for the new `GET /api/v1/me` endpoint.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sub` | string | Yes | Subject identifier (user ID from token) |
| `displayName` | string | No | User's display name (from `name` claim) |
| `email` | string | No | User's email address (from `email` or `preferred_username` claim) |
| `tenantId` | string | Yes | External tenant ID (from `tid` claim) |

**C# Model**:
```csharp
// Models/UserInfoResponse.cs
namespace Recall.Core.Api.Models;

public record UserInfoResponse(
    string Sub,
    string? DisplayName,
    string? Email,
    string TenantId
);
```

---

## MongoDB Documents (Updated)

### items Collection
```javascript
{
  "_id": ObjectId("..."),
  "url": "https://example.com/article",
  "normalizedUrl": "https://example.com/article",
  "title": "Interesting Article",
  "excerpt": "A brief summary...",
  "status": "unread",
  "isFavorite": false,
  "collectionId": ObjectId("..."),
  "tags": ["tech", "ai"],
  "createdAt": ISODate("2026-01-24T10:00:00Z"),
  "updatedAt": ISODate("2026-01-24T10:00:00Z"),
  "userId": "aaaabbbb-cccc-dddd-1111-222233334444"  // NEW
}
```

### collections Collection
```javascript
{
  "_id": ObjectId("..."),
  "name": "Tech Articles",
  "description": "Articles about technology",
  "parentId": null,
  "createdAt": ISODate("2026-01-24T10:00:00Z"),
  "updatedAt": ISODate("2026-01-24T10:00:00Z"),
  "userId": "aaaabbbb-cccc-dddd-1111-222233334444"  // NEW
}
```

---

## Query Patterns

### Read Operations (All Scoped by userId)

```javascript
// List items for user with pagination
db.items.find({
  userId: "user-sub-id",
  status: "unread",
  $or: [
    { createdAt: { $lt: cursorCreatedAt } },
    { createdAt: cursorCreatedAt, _id: { $lt: cursorId } }
  ]
})
.sort({ createdAt: -1, _id: -1 })
.limit(21)

// Get item by ID (ownership check)
db.items.findOne({ _id: ObjectId("..."), userId: "user-sub-id" })
// Returns null if not found OR not owned by user → 404
```

### Create Operations

```javascript
// Create item with userId
db.items.insertOne({
  url: "...",
  normalizedUrl: "...",
  status: "unread",
  isFavorite: false,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: "user-sub-id"  // Always set from authenticated user
})
```

### Update/Delete Operations

```javascript
// Update item (ownership enforced in filter)
db.items.updateOne(
  { _id: ObjectId("..."), userId: "user-sub-id" },
  { $set: { title: "New Title", updatedAt: new Date() } }
)
// Returns modifiedCount: 0 if not found OR not owned → 404

// Delete item (ownership enforced in filter)
db.items.deleteOne({ _id: ObjectId("..."), userId: "user-sub-id" })
// Returns deletedCount: 0 if not found OR not owned → 404
```

---

## Migration Notes

### No Automatic Migration

Per FR-022a, pre-existing records without a `userId` field are treated as orphaned:
- They will not appear in any user's queries
- They cannot be updated or deleted through the API
- Manual migration script required if data recovery needed

### Index Migration

Indexes should be recreated to include `userId` prefix:

```javascript
// Drop old indexes
db.items.dropIndex("normalizedUrl_1")
db.items.dropIndex("createdAt_-1__id_-1")
db.items.dropIndex("status_1_createdAt_-1")
db.items.dropIndex("collectionId_1_createdAt_-1")
db.items.dropIndex("tags_1")
db.collections.dropIndex("name_1")
db.collections.dropIndex("parentId_1")

// Create new userId-prefixed indexes
db.items.createIndex({ userId: 1, normalizedUrl: 1 }, { unique: true })
db.items.createIndex({ userId: 1, createdAt: -1, _id: -1 })
db.items.createIndex({ userId: 1, status: 1, createdAt: -1 })
db.items.createIndex({ userId: 1, collectionId: 1, createdAt: -1 })
db.items.createIndex({ userId: 1, tags: 1 })
db.collections.createIndex({ userId: 1, name: 1 }, { unique: true })
db.collections.createIndex({ userId: 1, parentId: 1 })
```

---

## Relationships (Updated)

```
┌─────────────────────┐
│   Authenticated     │
│   User (External)   │
│                     │
│  sub (from token)   │◄───────────────────────┐
└─────────────────────┘                        │
         │                                     │
         │ userId (FK to token sub)            │
         │                                     │
         ▼                                     │
┌─────────────────┐                            │
│   Collection    │                            │
│                 │                            │
│  id (PK)        │◄──────┐                    │
│  name (unique/u)│       │ parentId           │
│  userId ────────┼───────┼────────────────────┤
│  parentId (FK) ─┼───────┘                    │
└────────┬────────┘                            │
         │                                     │
         │ collectionId (FK, nullable)         │
         │                                     │
         ▼                                     │
┌─────────────────┐                            │
│      Item       │                            │
│                 │                            │
│  id (PK)        │                            │
│  normalizedUrl  │ (unique per user)          │
│  userId ────────┼────────────────────────────┘
│  collectionId   │──────► Collection.id (same user)
│  tags[]         │ (embedded)
└─────────────────┘
```

**Referential Integrity Rules**:
- `Item.userId` → Must match authenticated user's `sub` claim
- `Item.collectionId` → `Collection.id` where `Collection.userId == Item.userId`
- `Collection.userId` → Must match authenticated user's `sub` claim
- `Collection.parentId` → `Collection.id` where both have same `userId`
