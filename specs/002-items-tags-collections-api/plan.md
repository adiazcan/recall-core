````markdown
# Implementation Plan: Items, Tags, and Collections API

**Branch**: `002-items-tags-collections-api` | **Date**: 2026-01-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-items-tags-collections-api/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement core backend REST APIs for saving/managing URLs ("items"), organizing them with tags, and grouping them into collections. Focus on fast save (<200ms), URL deduplication, cursor-based pagination, and consistent error responses. MongoDB persistence via Aspire-managed connection. Single-user, no auth. No ingestion/enrichment/search.

## Technical Context

**Language/Version**: C# / .NET 10 (net10.0)  
**Primary Dependencies**: ASP.NET Core minimal API, MongoDB.Driver 3.x, Aspire.Hosting.MongoDB (13.1.0)  
**Storage**: MongoDB (Aspire-managed, database: `recalldb`)  
**Testing**: xUnit, WebApplicationFactory<Program>, Testcontainers.MongoDB for integration tests  
**Target Platform**: Linux server (local dev via Aspire AppHost)  
**Project Type**: Web application (backend API)  
**Performance Goals**: Save URL <200ms p95, list endpoints support pagination (default ≤50 items)  
**Constraints**: Single-user, no auth, no ingestion/enrichment, URLs max 2048 chars  
**Scale/Scope**: Single user, modest data volume (thousands of items)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **I. Product Focus** - Feature directly supports saving/reading/finding bookmarks? | ✅ PASS | Core save/organize functionality—no scope creep |
| **II. Privacy-First** - No tracking, secrets protected, sanitization planned? | ✅ PASS | Single-user, no external requests, no tracking |
| **III. Code Quality** - Domain/App/Infra layering, consistent naming? | ✅ PASS | Minimal API endpoints + MongoDB repository pattern |
| **IV. Testing Discipline** - Test strategy for each layer defined? | ✅ PASS | Integration tests with Testcontainers for API + DB |
| **V. Performance** - Save <200ms, pagination, no N+1? | ✅ PASS | Fast ack, cursor pagination, indexed queries |
| **VI. Reliability** - Deduplication, idempotency? | ✅ PASS | URL normalization + upsert for duplicates |
| **VII. User Experience** - Accessible API design? | ✅ PASS | REST conventions, consistent error contract |
| **VIII. Observability** - Structured logging, correlation IDs? | ✅ PASS | Using Aspire ServiceDefaults (OpenTelemetry) |
| **IX. Development Workflow** - Spec-first, small PRs? | ✅ PASS | Following spec → plan → tasks flow |

**Pre-Phase 0 Gate**: ✅ PASSED — No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/002-items-tags-collections-api/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI spec)
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── Recall.Core.Api/
│   ├── Program.cs                    # Endpoint definitions
│   ├── Endpoints/                    # Endpoint modules
│   │   ├── ItemsEndpoints.cs
│   │   ├── TagsEndpoints.cs
│   │   └── CollectionsEndpoints.cs
│   ├── Models/                       # Request/response DTOs
│   │   ├── ItemDto.cs
│   │   ├── TagDto.cs
│   │   ├── CollectionDto.cs
│   │   └── ErrorResponse.cs
│   ├── Entities/                     # MongoDB documents
│   │   ├── Item.cs
│   │   ├── Tag.cs (embedded)
│   │   └── Collection.cs
│   ├── Repositories/                 # Data access
│   │   ├── IItemRepository.cs
│   │   ├── ItemRepository.cs
│   │   ├── ICollectionRepository.cs
│   │   └── CollectionRepository.cs
│   └── Services/                     # Business logic
│       ├── IItemService.cs
│       ├── ItemService.cs
│       ├── ICollectionService.cs
│       └── CollectionService.cs
├── Recall.Core.AppHost/
│   └── AppHost.cs                    # Aspire orchestration (already has MongoDB)
├── Recall.Core.ServiceDefaults/
│   └── Extensions.cs
└── tests/
    └── Recall.Core.Api.Tests/
        ├── HealthEndpointTests.cs    # Existing
        ├── ItemsEndpointTests.cs     # New
        ├── TagsEndpointTests.cs      # New
        ├── CollectionsEndpointTests.cs # New
        └── TestFixtures/
            └── MongoDbFixture.cs     # Testcontainers setup
```

**Structure Decision**: Extending existing `Recall.Core.Api` project with Endpoints/Models/Entities/Repositories/Services folders following .NET minimal API conventions. No new projects needed—keeping complexity minimal per constitution.

## Complexity Tracking

> No violations to justify. Feature follows established patterns.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

````
