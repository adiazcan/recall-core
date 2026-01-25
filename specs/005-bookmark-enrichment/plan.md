# Implementation Plan: Bookmark Enrichment

**Branch**: `005-bookmark-enrichment` | **Date**: 2026-01-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-bookmark-enrichment/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement asynchronous bookmark enrichment that extracts title, excerpt, and thumbnail for newly created items. The pipeline uses **Dapr Pub/Sub** (backed by Redis) for job coordination, a new Enrichment microservice with Playwright for screenshot fallback, and Azure Blob Storage for thumbnail storage. POST /items remains fast (<500ms) while enrichment runs in background.

## Technical Context

**Language/Version**: C# / .NET 10, TypeScript / ES2022  
**Primary Dependencies**: Aspire 13.1.0, CommunityToolkit.Aspire.Hosting.Dapr, Dapr.AspNetCore 1.14.0, MongoDB.Driver.v2, Microsoft.Playwright, Azure.Storage.Blobs, AngleSharp, SkiaSharp  
**Messaging**: Dapr Pub/Sub (Redis backing store) - per constitution mandate  
**Storage**: MongoDB (items, enrichment status), Azure Blob Storage (thumbnails), Redis (Dapr Pub/Sub backing store)  
**Testing**: xUnit (backend), Vitest (frontend), Playwright (e2e)  
**Target Platform**: Linux containers (API + Enrichment workers with Dapr sidecars), Browser (React frontend)  
**Project Type**: web (backend + frontend with new microservice)  
**Performance Goals**: POST /items <500ms p95; enrichment jobs complete <30s for typical pages  
**Constraints**: <200ms item save response (async enrichment), SSRF protection required, max 5MB HTML fetch, 10s connect timeout  
**Scale/Scope**: Single tenant per deployment, designed for personal use (~10k bookmarks)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check (Phase 0)

| Gate | Status | Notes |
|------|--------|-------|
| Feature aligns with Product Focus (minimal scope)? | ✅ PASS | Enrichment directly supports saving and viewing bookmarks with richer metadata |
| Privacy requirements addressed (sanitization, no tracking)? | ✅ PASS | User-agent stripped, HTML not stored, thumbnails per-user isolated |
| Architecture follows domain/app/infra layers? | ✅ PASS | New microservice with entities/services/repositories pattern |
| Testing strategy defined for each layer? | ✅ PASS | xUnit integration tests, SSRF blocking tests, auth/ownership tests |
| Performance budget established (<200ms save, pagination)? | ✅ PASS | Async enrichment keeps POST <500ms; pagination already exists |
| Reliability patterns included (timeouts, retries)? | ✅ PASS | Exponential backoff, max attempts, timeouts on all external fetches |
| Accessibility requirements specified? | ⚪ N/A | Backend-only feature; frontend shows existing fields |
| Observability hooks planned (logs, correlation IDs)? | ✅ PASS | Structured logging for job lifecycle, OpenTelemetry via ServiceDefaults |

### Post-Design Check (Phase 1)

| Gate | Status | Notes |
|------|--------|-------|
| Data model follows established patterns? | ✅ PASS | Item entity extended with new fields; same BsonElement conventions |
| API contracts consistent with existing endpoints? | ✅ PASS | Same error responses, authorization patterns, OpenAPI structure |
| SSRF protection validated in research? | ✅ PASS | DNS resolution + IP range blocking documented in research.md |
| Thumbnail ownership isolation verified? | ✅ PASS | Storage keys scoped by userId; endpoint returns 404 for non-owners |
| No sensitive data in logs/errors? | ✅ PASS | EnrichmentError sanitized; no stack traces exposed |
| Async patterns match constitution reliability requirements? | ✅ PASS | Queue with visibility timeout, exponential backoff, max attempts |

**Constitution Check Result**: PASS - All applicable gates satisfied in both phases.

## Project Structure

### Documentation (this feature)

```text
specs/005-bookmark-enrichment/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Recall.Core.Api/                    # Existing API (extended)
│   ├── Endpoints/
│   │   ├── ItemsEndpoints.cs           # Extended: thumbnail endpoint, enrich endpoint, Dapr publish
│   │   └── ...
│   ├── Entities/
│   │   └── Item.cs                     # Extended: enrichment fields
│   └── Models/
│       └── ItemDto.cs                  # Extended: enrichment fields in response
│
├── Recall.Core.Enrichment/             # NEW: Enrichment microservice (Dapr subscriber)
│   ├── Recall.Core.Enrichment.csproj
│   ├── Program.cs                      # ASP.NET host with Dapr subscriber
│   ├── Controllers/
│   │   └── EnrichmentController.cs     # Dapr Pub/Sub subscriber endpoint
│   ├── Services/
│   │   ├── IEnrichmentService.cs       # Orchestrates enrichment flow
│   │   ├── EnrichmentService.cs
│   │   ├── IHtmlFetcher.cs             # URL fetching with SSRF protection
│   │   ├── HtmlFetcher.cs
│   │   ├── IMetadataExtractor.cs       # Title/excerpt extraction
│   │   ├── MetadataExtractor.cs
│   │   ├── IThumbnailGenerator.cs      # og:image + Playwright fallback
│   │   ├── ThumbnailGenerator.cs
│   │   └── SsrfValidator.cs            # IP/DNS validation
│   └── Storage/
│       ├── IThumbnailStorage.cs        # Blob storage abstraction
│       └── BlobThumbnailStorage.cs     # Azure Blob implementation
│
├── Recall.Core.AppHost/                # Extended with Dapr + Redis
│   ├── AppHost.cs                      # Add Redis, Dapr sidecars, enrichment service
│   └── components/                     # NEW: Dapr component definitions
│       ├── pubsub.yaml                 # Redis-backed Pub/Sub component
│       ├── subscription.yaml           # enrichment.requested topic subscription
│       └── resiliency.yaml             # Timeouts, retries, circuit breakers
│
└── Recall.Core.ServiceDefaults/        # Shared (unchanged)

src/tests/
├── Recall.Core.Api.Tests/              # Extended: enrichment integration tests
└── Recall.Core.Enrichment.Tests/       # NEW: enrichment service tests

src/web/src/                            # Frontend (minor changes)
├── features/items/
│   └── types.ts                        # Extended: enrichment fields in ItemDto
└── ...
```

**Structure Decision**: Web application structure with existing API + new Enrichment microservice. The Enrichment service:
- Is a Dapr Pub/Sub subscriber (ASP.NET Core with `[Topic]` attribute)
- Uses Dapr sidecar for message delivery and resiliency policies
- Isolates Playwright/image processing from API for independent scaling

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 4th project (Recall.Core.Enrichment) | Isolates Playwright/image processing from API; enables independent scaling | Running enrichment in API process would block request threads and complicate deployment |
| Dapr sidecar + package deps (Dapr.AspNetCore, CommunityToolkit.Aspire.Hosting.Dapr) | Constitution mandates Pub/Sub for async workflows; Dapr provides portable abstraction with resiliency | Direct Azure Storage Queue violates constitution; in-memory loses jobs on restart |
| Redis for Pub/Sub backing | Dapr requires backing store; Redis is lightweight and Aspire-integrated | Azure Service Bus adds cloud dependency for local dev; in-memory not durable |
