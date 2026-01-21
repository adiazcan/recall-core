````markdown
# Research: Items, Tags, and Collections API

**Feature**: 002-items-tags-collections-api  
**Date**: 2026-01-21

## Research Tasks

### 1. MongoDB .NET Driver with Aspire Integration

**Decision**: Use `Aspire.MongoDB.Driver.v2` (v13.1.0) package with `AddMongoDBClient` extension

**Rationale**:
- Aspire provides automatic service registration via `builder.AddMongoDBClient("recalldb")`
- Registers `IMongoClient` and `IMongoDatabase` in DI container automatically
- Connection string injected from AppHost via `WithReference(mongodb)`
- Built-in health checks, OpenTelemetry tracing, and resilience
- Aligns with existing Aspire 13.1.0 infrastructure in AppHost

**Alternatives Considered**:
- Raw `MongoDB.Driver` with manual DI: More boilerplate, no built-in health checks
- Entity Framework Core for MongoDB: Overkill for simple document storage, less MongoDB-native

**Implementation Pattern**:
```csharp
// In API Program.cs
builder.AddMongoDBClient("recalldb");

// In services/repositories - inject IMongoDatabase
public class ItemRepository(IMongoDatabase database)
{
    private readonly IMongoCollection<Item> _items = database.GetCollection<Item>("items");
}
```

---

### 2. URL Normalization for Deduplication

**Decision**: Normalize URLs before storage using standard rules

**Rationale**:
- Constitution requires URL deduplication (VI. Reliability)
- Prevents duplicate entries for equivalent URLs
- Case-insensitive scheme/host, sorted query params, stripped fragments

**Normalization Rules**:
1. Lowercase scheme (http/https)
2. Lowercase host
3. Remove default ports (80 for http, 443 for https)
4. Remove trailing slash on path (unless root)
5. Sort query parameters alphabetically
6. Remove fragment (#section)
7. Decode percent-encoded characters where safe

**Implementation**:
```csharp
public static string NormalizeUrl(string url)
{
    if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        throw new ArgumentException("Invalid URL");
    
    if (uri.Scheme != "http" && uri.Scheme != "https")
        throw new ArgumentException("Only http/https URLs allowed");
    
    var builder = new UriBuilder(uri)
    {
        Scheme = uri.Scheme.ToLowerInvariant(),
        Host = uri.Host.ToLowerInvariant(),
        Port = (uri.IsDefaultPort) ? -1 : uri.Port,
        Fragment = string.Empty
    };
    
    // Sort query params if present
    if (!string.IsNullOrEmpty(uri.Query))
    {
        var queryParams = HttpUtility.ParseQueryString(uri.Query);
        var sortedParams = queryParams.AllKeys
            .Where(k => k != null)
            .OrderBy(k => k)
            .Select(k => $"{k}={queryParams[k]}");
        builder.Query = string.Join("&", sortedParams);
    }
    
    return builder.Uri.ToString().TrimEnd('/');
}
```

---

### 3. Cursor-Based Pagination Strategy

**Decision**: Use opaque cursor (base64-encoded JSON with `_id` + `createdAt`) for stable pagination

**Rationale**:
- Constitution requires pagination on all list endpoints (V. Performance)
- Cursor-based is more stable than offset when items are added/deleted
- MongoDB `_id` is always indexed and ordered
- Combining with `createdAt` ensures consistent sort order

**Cursor Format**:
```json
{
  "id": "ObjectId",
  "createdAt": "ISO8601"
}
// Encoded as base64 for opaque cursor string
```

**Implementation Pattern**:
```csharp
// Decode cursor
if (!string.IsNullOrEmpty(cursor))
{
    var decoded = DecodeCursor(cursor);
    filter &= Builders<Item>.Filter.Lt(x => x.CreatedAt, decoded.CreatedAt) |
              (Builders<Item>.Filter.Eq(x => x.CreatedAt, decoded.CreatedAt) &
               Builders<Item>.Filter.Lt(x => x.Id, decoded.Id));
}

// Query with limit + 1 to detect hasMore
var items = await collection
    .Find(filter)
    .SortByDescending(x => x.CreatedAt)
    .ThenByDescending(x => x.Id)
    .Limit(pageSize + 1)
    .ToListAsync();

var hasMore = items.Count > pageSize;
var results = items.Take(pageSize).ToList();
var nextCursor = hasMore ? EncodeCursor(results.Last()) : null;
```

---

### 4. Tag Storage Strategy

**Decision**: Store tags as lowercase string array embedded in Item document

**Rationale**:
- Tags are simple labels, not complex entities
- Embedding avoids N+1 queries when listing items with tags
- Lowercase normalization ensures "Tech" == "tech" == "TECH"
- Tag listing/counts via aggregation pipeline

**Schema**:
```csharp
public class Item
{
    public ObjectId Id { get; set; }
    public string Url { get; set; }
    public string NormalizedUrl { get; set; }
    public string? Title { get; set; }
    public string? Excerpt { get; set; }
    public string Status { get; set; } = "unread"; // "unread" | "archived"
    public bool IsFavorite { get; set; }
    public ObjectId? CollectionId { get; set; }
    public List<string> Tags { get; set; } = []; // lowercase normalized
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**Tag Operations**:
- **List tags with counts**: `db.items.aggregate([{ $unwind: "$tags" }, { $group: { _id: "$tags", count: { $sum: 1 } } }])`
- **Rename tag globally**: `db.items.updateMany({ tags: "old" }, { $set: { "tags.$": "new" } })`
- **Delete tag (detach)**: `db.items.updateMany({ tags: "tag" }, { $pull: { tags: "tag" } })`

---

### 5. Collection Deletion Modes

**Decision**: Support two deletion modes: `default` (orphan items) and `cascade` (delete items)

**Rationale**:
- Spec requires both behaviors (User Story 4, scenarios 3-4)
- Default mode is safer—preserves user data
- Cascade mode for intentional bulk deletion

**Implementation**:
```csharp
public async Task DeleteCollectionAsync(ObjectId id, string mode = "default")
{
    if (mode == "cascade")
    {
        // Delete all items in collection first
        await _items.DeleteManyAsync(x => x.CollectionId == id);
    }
    else // default
    {
        // Orphan items (set collectionId to null = inbox)
        await _items.UpdateManyAsync(
            x => x.CollectionId == id,
            Builders<Item>.Update.Set(x => x.CollectionId, null));
    }
    
    await _collections.DeleteOneAsync(x => x.Id == id);
}
```

---

### 6. Integration Testing with Testcontainers

**Decision**: Use `Testcontainers.MongoDb` with `IAsyncLifetime` fixture for xUnit

**Rationale**:
- Real MongoDB instance for accurate integration tests
- Container lifecycle managed per test class
- Works with WebApplicationFactory for full API testing
- Aligns with constitution testing discipline (IV)

**Package**: `Testcontainers.MongoDb` (NuGet)

**Fixture Pattern**:
```csharp
public class MongoDbFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _container = new MongoDbBuilder()
        .WithImage("mongo:7")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync() => await _container.StartAsync();
    public async Task DisposeAsync() => await _container.DisposeAsync();
}

public class ItemsEndpointTests : IClassFixture<MongoDbFixture>
{
    private readonly HttpClient _client;
    
    public ItemsEndpointTests(MongoDbFixture mongo)
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", mongo.ConnectionString);
            });
        _client = factory.CreateClient();
    }
}
```

---

### 7. Error Response Contract

**Decision**: Consistent error envelope per constitution API conventions

**Rationale**:
- Constitution specifies: `{ "error": { "code": "...", "message": "..." } }`
- Enables client-side error handling consistency
- Differentiates error types via code

**Error Codes**:
| HTTP Status | Code | Usage |
|-------------|------|-------|
| 400 | `validation_error` | Invalid input (URL, required fields) |
| 400 | `invalid_url` | URL not http/https or malformed |
| 404 | `not_found` | Resource doesn't exist |
| 409 | `conflict` | Duplicate resource (collection name) |

**Implementation**:
```csharp
public record ErrorResponse(ErrorDetail Error);
public record ErrorDetail(string Code, string Message);

// Usage
return Results.BadRequest(new ErrorResponse(new ErrorDetail("invalid_url", "URL must be http or https")));
```

---

### 8. MongoDB Indexes

**Decision**: Create indexes for common query patterns

**Rationale**:
- Constitution prohibits N+1 queries; indexes prevent full collection scans
- Support fast lookups by normalized URL (deduplication)
- Support filtered listing by status, collection, tags

**Required Indexes**:
```javascript
// Items collection
db.items.createIndex({ "normalizedUrl": 1 }, { unique: true });
db.items.createIndex({ "createdAt": -1, "_id": -1 }); // pagination
db.items.createIndex({ "status": 1, "createdAt": -1 }); // filter by status
db.items.createIndex({ "collectionId": 1, "createdAt": -1 }); // filter by collection
db.items.createIndex({ "tags": 1 }); // filter by tag

// Collections collection
db.collections.createIndex({ "name": 1 }, { unique: true });
```

**Implementation**: Create indexes on application startup via `IHostedService` or migration.

---

## Summary

All research tasks resolved. No NEEDS CLARIFICATION items remain.

| Topic | Decision |
|-------|----------|
| MongoDB integration | Aspire.MongoDB.Driver.v2 with `AddMongoDBClient` |
| URL deduplication | Normalize and store `normalizedUrl` with unique index |
| Pagination | Cursor-based (base64 JSON with id + createdAt) |
| Tags | Embedded lowercase string array in Item |
| Collection deletion | Two modes: default (orphan) and cascade |
| Testing | Testcontainers.MongoDb + WebApplicationFactory |
| Errors | Consistent `{ error: { code, message } }` envelope |
| Indexes | Created on startup for query patterns |

````
