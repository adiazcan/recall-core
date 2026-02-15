# Implementation Plan: Tag Entity Refactor

**Branch**: `009-tag-entity-refactor` | **Date**: 2026-02-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-tag-entity-refactor/spec.md`

## Summary

Refactor tags from embedded strings on Items to first-class Tag entities with their own MongoDB collection. Introduces Tag CRUD (create, list, rename, delete by ID), migrates Items from `tags: string[]` to `tagIds: ObjectId[]` with tag-entity references, provides safe idempotent migration with rollback, and updates the web UI with a tag management screen and searchable tag picker. Items support `tagIds` + `newTagNames` fields for inline tag creation. Tag uniqueness enforced per user on normalized name.

## Technical Context

**Language/Version**: C# / .NET 10 (net10.0), TypeScript ES2022
**Primary Dependencies**: ASP.NET minimal API, MongoDB.Driver, Aspire 13.1.0, Dapr, React 19, React Router 7, Zustand, Tailwind CSS 4, Vitest
**Storage**: MongoDB (existing `recalldb` — new `tags` collection, modified `items` collection)
**Testing**: xUnit + WebApplicationFactory + Testcontainers (backend), Vitest + @testing-library/react (frontend)
**Target Platform**: Linux server (backend), Web browser (frontend)
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: Tag CRUD operations <200ms p95, tag picker search suggestions <1s, items list with expanded tags no N+1 queries
**Constraints**: <200ms p95 for save operations (constitution), pagination on all list endpoints (max 50), max 50 tags per item
**Scale/Scope**: Per-user tag namespace, migration covers all existing items with embedded tags

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Product Focus**: Tags directly support organizing/finding bookmarks — core functionality. No scope creep (global tags, AI-tagging, hierarchies explicitly out of scope).
- [x] **Privacy-First**: Tags are user-scoped. 404 (not 403) for cross-user access. No analytics or tracking. Migration data export contains no cross-user information.
- [x] **Code Quality**: New Tag entity follows domain/infrastructure layering. `ITagRepository` interface in domain, `TagRepository` implementation in infrastructure. Consistent with existing `IItemRepository` pattern. Namespace: `Recall.Core`.
- [x] **Testing Discipline**: Unit tests for normalization/validation, integration tests for Tag CRUD endpoints + migration, data isolation tests for cross-user tag access, frontend component tests with Vitest.
- [x] **Performance**: Tag operations target <200ms. No N+1 queries — expanded tags fetched via batch lookup. Pagination on tag list. Compound index `(userId, normalizedName)` for uniqueness + efficient queries.
- [x] **Reliability**: Migration is idempotent with rollback. Concurrent tag creation handled via unique constraint (upsert pattern). Graceful handling of invalid tag IDs on item save.
- [x] **User Experience**: Tag management screen with empty state guidance. Tag picker with search + inline create. Tag chips for display. Keyboard accessibility for tag picker.
- [x] **Observability**: OpenTelemetry spans for tag operations (`tags.search`, `item.create.enrich.tags_map`). Structured logging for migration metrics. No sensitive data in logs.
- [x] **Development Workflow**: Spec-first (spec.md exists). Branch `009-tag-entity-refactor`. API contracts defined in OpenAPI.

**Pre-design gate: PASSED** — No violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-tag-entity-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # OpenAPI 3.1 contract for tag + item endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/Recall.Core.Api/
├── Entities/
│   ├── Item.cs           # Modified: add TagIds, keep Tags temporarily
│   └── Tag.cs            # NEW: Tag entity
├── Endpoints/
│   ├── ItemsEndpoints.cs # Modified: tagIds + newTagNames support, expanded tags response
│   └── TagsEndpoints.cs  # Rewritten: ID-based CRUD replacing name-based operations
├── Models/
│   ├── TagDto.cs         # Modified: id, displayName, normalizedName, color, itemCount
│   ├── CreateTagRequest.cs    # NEW
│   ├── UpdateTagRequest.cs    # NEW
│   ├── CreateItemRequest.cs   # Modified: tagIds + newTagNames
│   └── UpdateItemRequest.cs   # Modified: tagIds + newTagNames
├── Repositories/
│   ├── ITagRepository.cs      # NEW: Tag repository interface
│   ├── TagRepository.cs       # NEW: Tag repository implementation
│   ├── IItemRepository.cs     # Modified: tag ID-based queries
│   └── ItemRepository.cs      # Modified: tag ID-based queries
├── Services/
│   ├── ITagService.cs         # NEW: Tag service interface
│   ├── TagService.cs          # NEW: Tag service (normalization, validation)
│   ├── ItemService.cs         # Modified: tag ID resolution, inline creation
│   └── TagNormalizer.cs       # NEW: Normalization utility
└── Migration/
    ├── TagMigrationService.cs # NEW: Migration job
    └── TagMigrationRunner.cs  # NEW: CLI runner for migration

src/web/src/
├── types/
│   └── entities.ts            # Modified: Tag type with id, Item.tags → Tag[]
├── lib/api/
│   ├── tags.ts                # Rewritten: ID-based CRUD
│   └── items.ts               # Modified: tagIds + newTagNames
├── features/tags/
│   ├── store.ts               # Rewritten: ID-based operations
│   ├── components/
│   │   ├── TagList.tsx         # Modified: use tag ID for routing
│   │   ├── TagChip.tsx         # Modified: use Tag object
│   │   ├── TagPicker.tsx       # NEW: searchable tag picker with inline create
│   │   └── TagManagement.tsx   # NEW: tag management screen
│   └── hooks/
│       └── useTagSearch.ts     # NEW: debounced tag search hook
├── features/items/
│   ├── store.ts               # Modified: tagIds + newTagNames
│   └── components/            # Modified: use TagPicker, TagChip with Tag objects
├── pages/
│   └── TagManagementPage.tsx  # NEW: tag management route
└── routes.tsx                 # Modified: add /tags/manage route, update /tags/:id

src/tests/
├── Recall.Core.Api.Tests/
│   ├── Endpoints/
│   │   ├── TagsEndpointTests.cs  # Rewritten: ID-based CRUD tests
│   │   └── ItemsEndpointTests.cs # Modified: tagIds + expanded tags tests
│   └── Auth/
│       └── DataIsolationTests.cs # Modified: tag isolation tests
└── Recall.Core.Api.Tests.csproj
```

**Structure Decision**: Follows existing web application structure with backend in `src/Recall.Core.Api/` and frontend in `src/web/src/`. No new projects needed — Tag entity and repository live alongside existing Item entity and repository. Migration tooling is a new `Migration/` folder within the API project (can be invoked as a CLI command or endpoint).

## Constitution Check — Post-Design Re-evaluation

*Re-checked after Phase 1 design completion.*

- [x] **Product Focus**: Design adds only what's needed — Tag CRUD, item tag references, migration, tag picker UI. No scope creep. Out-of-scope items (merge, archive, hierarchies, AI-tagging) confirmed excluded from contracts.
- [x] **Privacy-First**: All tag operations scoped to `userId` in every query. 404 for cross-user access confirmed in API contract. Migration export is per-user. No external requests or tracking introduced.
- [x] **Code Quality**: `ITagRepository`/`TagRepository` follows existing `IItemRepository`/`ItemRepository` pattern. `TagNormalizer` utility extracted from existing inline normalization. Domain layering preserved. Namespace `Recall.Core.Api` consistent.
- [x] **Testing Discipline**: Test strategy covers: unit tests for `TagNormalizer`, integration tests for all Tag CRUD endpoints + item tag operations, data isolation tests, migration idempotency tests. Frontend: Vitest tests for `TagPicker`, `TagManagement`, store.
- [x] **Performance**: Batch tag expansion via `$in` query (2 queries per item list, not N+1). Unique compound index `(userId, normalizedName)` serves both uniqueness and listing queries. Tag rename is O(1) — only updates Tag document. Migration processes in batches.
- [x] **Reliability**: Concurrent tag creation handled via unique index + `DuplicateKey` catch (same pattern as URL deduplication). Migration is idempotent (skips already-migrated items). Rollback via exported JSON mapping. Invalid tag IDs on item save silently ignored.
- [x] **User Experience**: Tag management screen with empty state. Tag picker with search + inline create. Tag chips with color support. Pagination on tag list. Keyboard accessibility specified.
- [x] **Observability**: OpenTelemetry spans planned for `tags.create`, `tags.search`, `tags.delete`, `item.create.tags_resolve`. Migration logs structured metrics (items processed, tags created, duplicates merged). No secrets in logs.
- [x] **Development Workflow**: Spec → Plan → Tasks flow followed. OpenAPI contract v1.3.0 defined. Branch `009-tag-entity-refactor`.

**Post-design gate: PASSED** — No violations. Design is consistent with all constitution principles.
