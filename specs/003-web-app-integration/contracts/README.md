# API Contracts

This feature **consumes** the existing backend API defined in feature 002.

See: [/specs/002-items-tags-collections-api/contracts/openapi.yaml](../../002-items-tags-collections-api/contracts/openapi.yaml)

## Consumed Endpoints

### Items
- `POST /api/v1/items` - Save a new URL
- `GET /api/v1/items` - List items with filters
- `GET /api/v1/items/{id}` - Get item details
- `PATCH /api/v1/items/{id}` - Update item metadata
- `DELETE /api/v1/items/{id}` - Delete an item

### Collections
- `POST /api/v1/collections` - Create a collection
- `GET /api/v1/collections` - List all collections
- `GET /api/v1/collections/{id}` - Get collection details
- `PATCH /api/v1/collections/{id}` - Update a collection
- `DELETE /api/v1/collections/{id}` - Delete a collection

### Tags
- `GET /api/v1/tags` - List all tags with counts
- `PATCH /api/v1/tags/{name}` - Rename a tag
- `DELETE /api/v1/tags/{name}` - Delete a tag

### System
- `GET /health` - Health check

## Frontend Type Definitions

Frontend TypeScript types matching these contracts are defined in:
- [data-model.md](../data-model.md) - Entity mappings and store types
- Implementation: `src/web/src/lib/api/types.ts`
