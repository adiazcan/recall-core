# Implementation Plan: Synchronous Enrichment on Item Creation

**Branch**: `008-sync-enrichment` | **Date**: 2026-02-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-sync-enrichment/spec.md`

## Summary

Move core enrichment (title, excerpt, preview image URL extraction) from the async-only background worker into the synchronous `POST /api/v1/items` flow. Most bookmarks will be returned fully enriched on creation — including a `previewImageUrl` pointing to the page's `og:image` when available. No image bytes are downloaded during the sync request; the URL is stored directly. The async headless-browser screenshot job is retained **only** as a fallback when no `og:image` URL exists. This requires:

1. Extracting enrichment logic (HTML fetching, metadata extraction, SSRF validation) from `Recall.Core.Enrichment` into a new shared library `Recall.Core.Enrichment.Common`.
2. Calling the shared sync enrichment pipeline inside `ItemService.SaveItemAsync`.
3. Storing the `og:image` URL directly on the item (new `PreviewImageUrl` field) — no image download in sync path.
4. Narrowing the async enrichment worker to screenshot-only fallback when `PreviewImageUrl` is null.
5. Publishing async fallback jobs only when no preview image URL was found.

## Technical Context

**Language/Version**: C# / .NET 10 (`net10.0`)
**Primary Dependencies**: Aspire 13.1.0, Dapr.AspNetCore 1.14.0, MongoDB.Driver 2.30.0, AngleSharp 1.1.2, SkiaSharp 2.88.8, Microsoft.Playwright 1.47.0, Azure.Storage.Blobs 12.23.0
**Storage**: MongoDB (items), Azure Blob Storage (thumbnails)
**Testing**: xUnit 2.6.6, WebApplicationFactory + Testcontainers.MongoDb 3.9.0, Vitest (frontend)
**Target Platform**: Linux containers (Aspire AppHost for local dev, ACA for prod)
**Project Type**: Web (multi-project solution: API, Enrichment worker, AppHost, ServiceDefaults, shared lib)
**Performance Goals**: POST /items <5s p95 including sync enrichment (spec SC-003); save latency w/o enrichment <200ms p95 (constitution)
**Constraints**: Sync HTML fetch ≤3s timeout, max 5MB HTML; no image download in sync path (store og:image URL only); no headless browser in API process; async fallback within 60s
**Scale/Scope**: Single-user to small team; enrichment volume proportional to saves (~100s/day)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Product Focus**: Feature directly improves bookmark save experience — core mission. No scope creep.
- [x] **Privacy-First**: External HTTP requests strip cookies, use clean User-Agent. No tracking. SSRF protections shared. Thumbnail stored per-user, access-controlled. Note: `previewImageUrl` (og:image) is an external URL — the frontend loads it directly, which means the third-party server may see the user's IP. This is acceptable because og:image URLs are designed for public sharing and the user explicitly saved the bookmark.
- [x] **Code Quality**: Extracting shared library follows domain/app/infra layering. Eliminates current code duplication between API and Enrichment projects. Single responsibility per module.
- [x] **Testing Discipline**: Sync enrichment path requires unit tests (metadata extraction, SSRF) + integration tests (items endpoint with enrichment). Existing async worker tests retained.
- [⚠️] **Performance**: Constitution requires POST save <200ms p95. Sync enrichment adds latency (up to 5s with timeouts). **JUSTIFIED**: The spec explicitly relaxes save latency to <5s p95 for enriched saves. The item is always persisted first; enrichment is best-effort on the synchronous path. If enrichment times out, status=pending and async fallback runs — preserving the fast-save guarantee for degraded cases.
- [x] **Reliability**: Timeouts on all external calls. Graceful degradation (item always saved). Async fallback for failures. Dapr resiliency for pub/sub. Idempotent async worker.
- [x] **User Experience**: Eliminates "blank bookmark" for majority of saves. Loading indicator still available for pending items.
- [x] **Observability**: Structured logs for sync enrichment events. OTel metrics for sync success/failure/partial. Existing async metrics unchanged.
- [x] **Development Workflow**: Spec-first (this plan follows spec 008). PRs will be task-scoped.

### Post-Design Re-evaluation (Phase 1 complete)

All gates re-checked after data-model.md, contracts/openapi.yaml, and research.md were finalized:

- [x] **No new violations discovered.** The shared library correctly separates infrastructure concerns (HtmlFetcher, SsrfValidator, BlobThumbnailWriter) from the API's domain layer (Item entity, business rules). Interface-based DI preserves inward dependency flow.
- [x] **Privacy**: SSRF validation is shared via a single `ISsrfValidator` — no risk of inconsistent rules between sync and async paths.
- [x] **Testing**: New unit test project (`Recall.Core.Enrichment.Common.Tests`) covers all shared components. API integration tests will validate sync enrichment end-to-end.
- [x] **Observability**: Sync enrichment metrics (`enrichment.sync.succeeded`, `enrichment.sync.failed`, `enrichment.sync.duration`) defined alongside existing async metrics.
- [⚠️] **Performance violation remains justified**: POST save latency relaxed from <200ms to <5s p95. Item persistence occurs before enrichment. Documented in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-sync-enrichment/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Recall.Core.Enrichment.Common/          # NEW — shared enrichment library
│   ├── Recall.Core.Enrichment.Common.csproj
│   ├── Models/
│   │   ├── PageMetadata.cs                  # Title, Excerpt, OgImageUrl
│   │   └── SyncEnrichmentResult.cs          # Result of sync enrichment pipeline
│   ├── Services/
│   │   ├── IHtmlFetcher.cs                  # Interface
│   │   ├── HtmlFetcher.cs                   # Moved from Enrichment
│   │   ├── IMetadataExtractor.cs            # Interface
│   │   ├── MetadataExtractor.cs             # Moved from Enrichment
│   │   ├── ISsrfValidator.cs                # Interface
│   │   ├── SsrfValidator.cs                 # Moved from Enrichment
│   │   ├── ISyncEnrichmentService.cs        # New — orchestrates sync pipeline
│   │   └── SyncEnrichmentService.cs         # New — fetch HTML → extract metadata + og:image URL
│   └── Configuration/
│       └── EnrichmentOptions.cs             # Shared config (timeouts, size limits)
│
├── Recall.Core.Api/                         # MODIFIED
│   ├── Services/
│   │   └── ItemService.cs                   # Calls ISyncEnrichmentService before publishing async job
│   └── (removed duplicated enrichment types)
│
├── Recall.Core.Enrichment/                  # MODIFIED — narrowed to async fallback
│   ├── Services/
│   │   ├── EnrichmentService.cs             # Narrowed: image-only if title/excerpt exist
│   │   └── ThumbnailGenerator.cs            # Retained: Playwright screenshot only
│   └── (removed types now in Common)
│
├── Recall.Core.AppHost/                     # UNCHANGED
├── Recall.Core.ServiceDefaults/             # UNCHANGED
└── tests/
    ├── Recall.Core.Api.Tests/               # MODIFIED — add sync enrichment tests
    └── Recall.Core.Enrichment.Common.Tests/ # NEW — unit tests for shared library
```

**Structure Decision**: New shared library `Recall.Core.Enrichment.Common` eliminates code duplication of SSRF validation, metadata extraction, and HTML fetching between API and Enrichment projects. Both projects reference this library. The sync path stores the `og:image` URL directly — no image download, no blob upload, no SkiaSharp dependency in the API. The Enrichment worker retains Playwright screenshot logic and blob storage writes (not shared — too heavyweight for API). This introduces a 5th project but is justified by the DRY principle and the spec requirement to share SSRF/extraction logic.

## Complexity Tracking

> Constitution Check has one violation that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| POST save >200ms p95 | Sync enrichment adds latency for HTML fetch + parse (typically 0.5-3s). No image download in sync path — only the og:image URL is stored. Item persistence itself remains <200ms. | Keeping enrichment fully async means users always see blank bookmarks. The spec explicitly targets <5s p95 total with graceful degradation: if enrichment times out, the item is returned with status=pending and async fallback runs. The 200ms constitution budget applies to the "save acknowledgment" which is semantically preserved (item is persisted before enrichment runs). |
| 5th project (shared lib) | Shared enrichment library eliminates duplicated SSRF, metadata extraction, and HTML fetching code between API and Enrichment projects. The spec mandates "reusable components (shared sync/async)". | Duplicating extraction logic in the API project violates DRY and creates divergent SSRF rules. Merging API and Enrichment into one project violates single-responsibility (Playwright shouldn't run in the API process). |
