````markdown
# Quickstart: Items, Tags, and Collections API

**Feature**: 002-items-tags-collections-api  
**Date**: 2026-01-21

## Prerequisites

- .NET 10 SDK
- Docker Desktop (for MongoDB via Aspire)
- IDE: VS Code with C# Dev Kit or JetBrains Rider

## Running Locally

### 1. Start the Application

From the repository root:

```bash
cd src/Recall.Core.AppHost
dotnet run
```

This starts:
- MongoDB container (via Aspire)
- API at `http://localhost:5080`
- Web frontend at `http://localhost:5173`
- Aspire Dashboard at `http://localhost:15888`

### 2. Access Swagger UI

Open: **http://localhost:5080/swagger**

All endpoints are documented and can be tested interactively.

---

## Quick API Examples

### Save a URL

```bash
curl -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article", "title": "Interesting Article", "tags": ["tech", "reading"]}'
```

**Response** (201 Created):
```json
{
  "id": "507f1f77bcf86cd799439011",
  "url": "https://example.com/article",
  "normalizedUrl": "https://example.com/article",
  "title": "Interesting Article",
  "status": "unread",
  "isFavorite": false,
  "collectionId": null,
  "tags": ["tech", "reading"],
  "createdAt": "2026-01-21T10:00:00Z",
  "updatedAt": "2026-01-21T10:00:00Z"
}
```

### List Items (with filters)

```bash
# All unread items
curl "http://localhost:5080/api/v1/items?status=unread"

# Items with a specific tag
curl "http://localhost:5080/api/v1/items?tag=tech"

# Paginated (20 items, then use cursor)
curl "http://localhost:5080/api/v1/items?limit=20"
```

### Archive an Item

```bash
curl -X PATCH http://localhost:5080/api/v1/items/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{"status": "archived"}'
```

### Create a Collection

```bash
curl -X POST http://localhost:5080/api/v1/collections \
  -H "Content-Type: application/json" \
  -d '{"name": "Tech Articles", "description": "Articles about technology"}'
```

### Move Item to Collection

```bash
curl -X PATCH http://localhost:5080/api/v1/items/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{"collectionId": "507f1f77bcf86cd799439012"}'
```

### List Tags with Counts

```bash
curl http://localhost:5080/api/v1/tags
```

**Response**:
```json
{
  "tags": [
    { "name": "tech", "count": 15 },
    { "name": "reading", "count": 8 }
  ]
}
```

---

## Running Tests

### All Tests

```bash
cd src/tests/Recall.Core.Api.Tests
dotnet test
```

### Specific Test Class

```bash
dotnet test --filter "FullyQualifiedName~ItemsEndpointTests"
```

### With Coverage

```bash
dotnet test --collect:"XPlat Code Coverage"
```

---

## Project Structure

```
src/
├── Recall.Core.Api/
│   ├── Program.cs              # Entry point + endpoint mapping
│   ├── Endpoints/              # Endpoint modules (Items, Tags, Collections)
│   ├── Models/                 # DTOs (requests/responses)
│   ├── Entities/               # MongoDB documents
│   ├── Repositories/           # Data access layer
│   └── Services/               # Business logic
├── Recall.Core.AppHost/        # Aspire orchestration
└── tests/
    └── Recall.Core.Api.Tests/  # Integration tests
```

---

## Key Configuration

### Connection String (automatic via Aspire)

When running through AppHost, MongoDB connection is automatically injected:
- Connection name: `recalldb`
- Configured in `AppHost.cs`

### Manual Override (for tests)

Set environment variable:
```bash
ConnectionStrings__recalldb="mongodb://localhost:27017/recalldb"
```

---

## Error Handling

All errors follow the contract:

```json
{
  "error": {
    "code": "validation_error",
    "message": "URL must be http or https"
  }
}
```

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `validation_error` | Invalid input |
| 400 | `invalid_url` | URL not http/https or malformed |
| 404 | `not_found` | Resource doesn't exist |
| 409 | `conflict` | Duplicate (e.g., collection name) |

---

## Next Steps

1. Review [data-model.md](data-model.md) for entity details
2. Review [contracts/openapi.yaml](contracts/openapi.yaml) for full API spec
3. Run `/speckit.tasks` to generate implementation tasks

````
