````markdown
# Data Model: Items, Tags, and Collections API

**Feature**: 002-items-tags-collections-api  
**Date**: 2026-01-21

## Overview

This feature introduces three core domain entities for the Recall bookmarking application:
- **Item**: A saved URL with metadata (title, status, tags, collection assignment)
- **Tag**: Lightweight labels embedded within Items (not a separate collection)
- **Collection**: Folders for organizing Items with optional hierarchy

## Entities

### Item

The core entity representing a saved URL/bookmark.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | ObjectId | Auto | MongoDB document ID |
| `url` | string | Yes | Original URL as provided by user (max 2048 chars) |
| `normalizedUrl` | string | Yes | Canonicalized URL for deduplication (unique index) |
| `title` | string | No | User-provided or extracted title (max 500 chars) |
| `excerpt` | string | No | User-provided or extracted description (max 1000 chars) |
| `status` | string | Yes | Item state: `"unread"` (default) or `"archived"` |
| `isFavorite` | boolean | Yes | Favorite flag, default `false` |
| `collectionId` | ObjectId | No | Reference to Collection; `null` = inbox |
| `tags` | string[] | Yes | Lowercase-normalized tag labels, default `[]` |
| `createdAt` | DateTime | Yes | UTC timestamp when item was saved |
| `updatedAt` | DateTime | Yes | UTC timestamp of last modification |

**Validation Rules**:
- `url`: Must be valid http/https URL, max 2048 characters
- `status`: Enum constraint `["unread", "archived"]`
- `tags`: Each tag lowercase-normalized, trimmed, max 50 chars per tag
- `normalizedUrl`: Unique constraint for deduplication

**Indexes**:
```javascript
{ "normalizedUrl": 1 }        // unique, for deduplication lookup
{ "createdAt": -1, "_id": -1 } // pagination
{ "status": 1, "createdAt": -1 } // filter by status
{ "collectionId": 1, "createdAt": -1 } // filter by collection
{ "tags": 1 }                 // filter by tag (multikey index)
```

---

### Collection

A folder-like container for organizing Items.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | ObjectId | Auto | MongoDB document ID |
| `name` | string | Yes | Collection name (unique, max 100 chars) |
| `description` | string | No | Optional description (max 500 chars) |
| `parentId` | ObjectId | No | Parent collection for hierarchy; `null` = root |
| `createdAt` | DateTime | Yes | UTC timestamp when collection was created |
| `updatedAt` | DateTime | Yes | UTC timestamp of last modification |

**Validation Rules**:
- `name`: Required, unique, non-empty, max 100 characters
- `parentId`: Must reference existing collection if provided

**Indexes**:
```javascript
{ "name": 1 }     // unique, for conflict detection
{ "parentId": 1 } // for hierarchy queries
```

**Derived Field** (computed at query time):
- `itemCount`: Number of Items with `collectionId` matching this collection

---

### Tag (Embedded)

Tags are **not** stored as a separate collection. They are embedded as a string array within Item documents.

**Tag Properties**:
- Stored as lowercase string (normalized on save)
- Case-insensitive matching ("Tech" → "tech")
- No separate ID or metadata

**Tag Operations** (via aggregation):
- **List all tags with counts**: Aggregate `$unwind` + `$group`
- **Rename tag globally**: `updateMany` with `$set` on matched array element
- **Delete tag (detach)**: `updateMany` with `$pull`

---

## State Transitions

### Item Status

```
                    +------------------+
                    |                  |
        save        v     archive      |
  ──────────────► unread ──────────► archived
                    ^                  |
                    |    unarchive     |
                    +──────────────────+
```

| From | To | Trigger | Notes |
|------|----|---------|-------|
| — | `unread` | POST /items | Default status on creation |
| `unread` | `archived` | PATCH with `status: "archived"` | User marks as read |
| `archived` | `unread` | PATCH with `status: "unread"` | User moves back to inbox |

---

## Relationships

```
┌─────────────────┐
│   Collection    │
│                 │
│  id (PK)        │◄──────┐
│  name (unique)  │       │ parentId (self-ref)
│  parentId (FK) ─┼───────┘
└────────┬────────┘
         │
         │ collectionId (FK, nullable)
         │
         ▼
┌─────────────────┐
│      Item       │
│                 │
│  id (PK)        │
│  normalizedUrl  │ (unique)
│  collectionId   │──────► Collection.id (or null = inbox)
│  tags[]         │ (embedded)
└─────────────────┘
```

**Referential Integrity**:
- `Item.collectionId` → `Collection.id` (validated on save)
- `Collection.parentId` → `Collection.id` (validated on save)
- Deleting a Collection: Items orphaned (default) or cascaded (explicit mode)

---

## MongoDB Collections

### `items`
```javascript
{
  "_id": ObjectId("..."),
  "url": "https://example.com/article?ref=twitter",
  "normalizedUrl": "https://example.com/article?ref=twitter",
  "title": "Interesting Article",
  "excerpt": "A brief summary...",
  "status": "unread",
  "isFavorite": false,
  "collectionId": ObjectId("..."), // or null
  "tags": ["tech", "ai", "reading"],
  "createdAt": ISODate("2026-01-21T10:00:00Z"),
  "updatedAt": ISODate("2026-01-21T10:00:00Z")
}
```

### `collections`
```javascript
{
  "_id": ObjectId("..."),
  "name": "Tech Articles",
  "description": "Articles about technology",
  "parentId": null, // or ObjectId for nested
  "createdAt": ISODate("2026-01-21T10:00:00Z"),
  "updatedAt": ISODate("2026-01-21T10:00:00Z")
}
```

---

## Sample Queries

### Find item by normalized URL (deduplication)
```javascript
db.items.findOne({ normalizedUrl: "https://example.com/article" })
```

### List items with pagination (cursor-based)
```javascript
db.items.find({
  status: "unread",
  $or: [
    { createdAt: { $lt: cursorCreatedAt } },
    { createdAt: cursorCreatedAt, _id: { $lt: cursorId } }
  ]
})
.sort({ createdAt: -1, _id: -1 })
.limit(21) // pageSize + 1 to detect hasMore
```

### List all tags with counts
```javascript
db.items.aggregate([
  { $unwind: "$tags" },
  { $group: { _id: "$tags", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

### Get collection with item count
```javascript
db.collections.aggregate([
  { $match: { _id: collectionId } },
  {
    $lookup: {
      from: "items",
      localField: "_id",
      foreignField: "collectionId",
      as: "items"
    }
  },
  { $addFields: { itemCount: { $size: "$items" } } },
  { $project: { items: 0 } }
])
```

````
