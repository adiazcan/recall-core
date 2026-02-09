# Tasks: Synchronous Enrichment on Item Creation

**Input**: Design documents from `/specs/008-sync-enrichment/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new shared enrichment library project and wire it into the solution

- [x] T001 Create new class library project `src/Recall.Core.Enrichment.Common/Recall.Core.Enrichment.Common.csproj` targeting `net10.0` with AngleSharp 1.1.2 and Microsoft.Extensions.Http dependencies
- [x] T002 Add `Recall.Core.Enrichment.Common` project to `src/RecallCore.sln` via `dotnet sln add`
- [x] T003 [P] Add `<ProjectReference>` to `Recall.Core.Enrichment.Common` in `src/Recall.Core.Api/Recall.Core.Api.csproj`
- [x] T004 [P] Add `<ProjectReference>` to `Recall.Core.Enrichment.Common` in `src/Recall.Core.Enrichment/Recall.Core.Enrichment.csproj`
- [x] T005 Create directory structure for shared library: `src/Recall.Core.Enrichment.Common/Models/`, `src/Recall.Core.Enrichment.Common/Services/`, `src/Recall.Core.Enrichment.Common/Configuration/`
- [x] T006 Create new test project `src/tests/Recall.Core.Enrichment.Common.Tests/Recall.Core.Enrichment.Common.Tests.csproj` with xUnit 2.6.6 targeting `net10.0`, referencing `Recall.Core.Enrichment.Common`
- [x] T007 Add `Recall.Core.Enrichment.Common.Tests` project to `src/RecallCore.sln` via `dotnet sln add`
- [x] T008 Verify solution builds cleanly with `dotnet build src/RecallCore.sln`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract existing enrichment code into the shared library — MUST complete before any user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. These tasks move and refactor existing code.

### Models (shared library)

- [x] T009 [P] Create `PageMetadata` record (Title, Excerpt, OgImageUrl) in `src/Recall.Core.Enrichment.Common/Models/PageMetadata.cs` — moved from top-level record in `src/Recall.Core.Enrichment/Services/IMetadataExtractor.cs`
- [x] T010 [P] Create `SyncEnrichmentResult` record (Title, Excerpt, PreviewImageUrl, NeedsAsyncFallback, Error, Duration) in `src/Recall.Core.Enrichment.Common/Models/SyncEnrichmentResult.cs`
- [x] T011 [P] Extract `SsrfBlockedException` exception class from the bottom of `src/Recall.Core.Enrichment/Services/HtmlFetcher.cs` into its own file at `src/Recall.Core.Enrichment.Common/Models/SsrfBlockedException.cs`

### Configuration (shared library)

- [x] T012 Create unified `EnrichmentOptions` class in `src/Recall.Core.Enrichment.Common/Configuration/EnrichmentOptions.cs` with all shared properties (ThumbnailContainer, MaxResponseSizeBytes, FetchTimeoutSeconds=3, MasterTimeoutSeconds=4, MaxRedirects=3, ConnectTimeoutSeconds=10, ReadTimeoutSeconds=30, UserAgent) — consolidating from `src/Recall.Core.Api/Services/EnrichmentOptions.cs` and `src/Recall.Core.Enrichment/Services/EnrichmentOptions.cs`. Note: defaults are tuned for sync path (3s fetch); the Enrichment worker MUST override via its own `appsettings.json` `Enrichment` section (e.g., FetchTimeoutSeconds=30 for async)

### Interfaces (shared library)

- [x] T013 [P] Create `ISsrfValidator` interface in `src/Recall.Core.Enrichment.Common/Services/ISsrfValidator.cs` with `ValidateAsync(string url, CancellationToken)` method returning `SsrfValidationResult` — matches existing interface signature from `src/Recall.Core.Enrichment/Services/ISsrfValidator.cs`. Also move the `SsrfValidationResult` record into this file.
- [x] T014 [P] Create `IHtmlFetcher` interface in `src/Recall.Core.Enrichment.Common/Services/IHtmlFetcher.cs` with `FetchHtmlAsync(string url, CancellationToken)` method
- [x] T015 [P] Create `IMetadataExtractor` interface in `src/Recall.Core.Enrichment.Common/Services/IMetadataExtractor.cs` with `ExtractAsync(string html)` method
- [x] T016 [P] Create `ISyncEnrichmentService` interface in `src/Recall.Core.Enrichment.Common/Services/ISyncEnrichmentService.cs` with `EnrichAsync(string url, string userId, string itemId, CancellationToken)` method

### Implementations (moved to shared library)

- [x] T017 Move `SsrfValidator` implementation to `src/Recall.Core.Enrichment.Common/Services/SsrfValidator.cs` — update namespace from `Recall.Core.Enrichment.Services` to `Recall.Core.Enrichment.Common.Services`, implement `ISsrfValidator` from shared library
- [x] T018 Move `HtmlFetcher` implementation to `src/Recall.Core.Enrichment.Common/Services/HtmlFetcher.cs` — update namespace, use `IHttpClientFactory` with named client `enrichment-fetch` instead of direct `HttpClient` construction, implement `IHtmlFetcher` from shared library, remove `IDisposable` implementation (handler lifetime managed by `IHttpClientFactory`). Note: only `FetchHtmlAsync` moves to shared library; `FetchBytesAsync` (used for image download) remains exclusive to the async worker and should be kept in `Recall.Core.Enrichment` or re-implemented there
- [x] T019 Move `MetadataExtractor` implementation to `src/Recall.Core.Enrichment.Common/Services/MetadataExtractor.cs` — update namespace, use `PageMetadata` from `Recall.Core.Enrichment.Common.Models`, implement `IMetadataExtractor` from shared library

### Cleanup old files

- [x] T020 [P] Remove old `ISsrfValidator.cs`, `SsrfValidator.cs`, `IHtmlFetcher.cs`, `HtmlFetcher.cs`, `IMetadataExtractor.cs`, `MetadataExtractor.cs` from `src/Recall.Core.Enrichment/Services/` — update ALL remaining Enrichment code (including `EnrichmentService.cs`) to use `Recall.Core.Enrichment.Common.Services` and `Recall.Core.Enrichment.Common.Models` namespaces. This must be thorough so the Enrichment project builds cleanly at the end of Phase 2. Note: `FetchBytesAsync` remains in the Enrichment project — re-implement it locally or keep a local `IImageFetcher` if needed.
- [x] T021 [P] Remove old `EnrichmentOptions.cs` from `src/Recall.Core.Api/Services/` — update API code to use `Recall.Core.Enrichment.Common.Configuration` namespace
- [x] T022 [P] Remove old `EnrichmentOptions.cs` from `src/Recall.Core.Enrichment/Services/` — update Enrichment code to use `Recall.Core.Enrichment.Common.Configuration` namespace

### DI Registration (shared library services)

- [x] T023 Create `ServiceCollectionExtensions.cs` in `src/Recall.Core.Enrichment.Common/` with `AddEnrichmentCommon(this IServiceCollection)` extension method — registers `ISsrfValidator`, `IHtmlFetcher`, `IMetadataExtractor`, `ISyncEnrichmentService`, named HttpClient `enrichment-fetch`, and binds `EnrichmentOptions` from config section `"Enrichment"`
- [x] T024 Update `src/Recall.Core.Api/Program.cs` to call `builder.Services.AddEnrichmentCommon()` and remove old enrichment DI registrations
- [x] T025 Update `src/Recall.Core.Enrichment/Program.cs` to call `builder.Services.AddEnrichmentCommon()` and remove old enrichment DI registrations

### Entity Updates

- [x] T026 Add `PreviewImageUrl` nullable string property with `[BsonElement("previewImageUrl")]` to `Item` entity in `src/Recall.Core.Api/Entities/Item.cs`

### DTO Updates

- [x] T027 [P] Add `PreviewImageUrl` property to `ItemDto` in `src/Recall.Core.Api/Models/ItemDto.cs` and update `FromEntity` mapping logic to include the new field. Also verify endpoint-level serialization in `src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs` includes the field in API responses — ensure alignment with `contracts/openapi.yaml`
- [x] T028 Verify `dotnet build src/RecallCore.sln` succeeds after all foundational changes

**Checkpoint**: Shared library extracted, solution builds, all existing tests still pass. No behavioral changes yet — sync enrichment service not yet implemented.

### Shared Library Unit Tests (written alongside Phase 2 implementations)

- [x] T050 [P] Write unit tests for `SsrfValidator` — validate blocking of private IPs (10.x, 172.16-31.x, 192.168.x), localhost, loopback (127.x, ::1), link-local (169.254.x), non-http(s) schemes. Verify DNS-resolved IPs are checked (domain resolving to 127.0.0.1 is blocked). Verify valid public URLs pass. Per FR-017, FR-018
- [x] T051 [P] Write unit tests for `MetadataExtractor` — verify title priority (`og:title` → `<title>` → `<h1>`), excerpt priority (`og:description` → `meta[name=description]` → first paragraph), og:image/twitter:image extraction. Verify null handling for missing tags. Per FR-003
- [x] T052 [P] Write unit tests for `HtmlFetcher` — verify streaming with size limit (>5MB rejected), timeout behavior, redirect following (max 3), SSRF validation on redirect targets. Per FR-019, FR-020

---

## Phase 3: User Story 1 — Instant Enriched Bookmark (Priority: P1) 🎯 MVP

**Goal**: When a user saves a URL, the system fetches page metadata and og:image URL synchronously. The bookmark is returned with title, excerpt, and previewImageUrl populated.

**Independent Test**: Save a URL to a page with `og:title`, `meta description`, and `og:image`. Verify the response includes populated title, excerpt, previewImageUrl, and `enrichmentStatus=succeeded`.

### Implementation for User Story 1

- [x] T029 [US1] Implement `SyncEnrichmentService` in `src/Recall.Core.Enrichment.Common/Services/SyncEnrichmentService.cs` — orchestrate: create master CTS (4s linked to caller token) → validate URL via `ISsrfValidator` → fetch HTML via `IHtmlFetcher` with sub-CTS (3s) → extract metadata via `IMetadataExtractor` → build `SyncEnrichmentResult` with PreviewImageUrl from OgImageUrl, NeedsAsyncFallback=true when PreviewImageUrl is null, handle `SsrfBlockedException` and `OperationCanceledException` gracefully
- [x] T030 [US1] Update `ItemService.SaveItemAsync` in `src/Recall.Core.Api/Services/ItemService.cs` — after item persistence (before publishing async job): call `ISyncEnrichmentService.EnrichAsync()`, apply result to item (user-provided title/excerpt win per FR-008), update enrichmentStatus/enrichedAt/enrichmentError/previewImageUrl, persist updated item. Return enrichment result info in `SaveItemResult` so the endpoint can decide whether to publish async fallback
- [x] T030b [US1] Update `ItemsEndpoints.cs` in `src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs` — modify the POST `/api/v1/items` handler to publish Dapr async fallback job (`enrichment-pubsub`, `enrichment.requested`) ONLY when the `SaveItemResult` indicates `NeedsAsyncFallback == true` and enrichmentStatus is NOT `"failed"` (SSRF-blocked). Remove the current unconditional publish. This is where the Dapr `PublishEventAsync` call currently lives (not in `ItemService`).
- [x] T031 [US1] Add `Enrichment` configuration section with sync timeout values to `src/Recall.Core.Api/appsettings.json` — FetchTimeoutSeconds=3, MasterTimeoutSeconds=4, MaxResponseSizeBytes=5242880, MaxRedirects=3, UserAgent="Recall.Enrichment/1.0"
- [x] T032 [US1] Add structured logging to `SyncEnrichmentService` in `src/Recall.Core.Enrichment.Common/Services/SyncEnrichmentService.cs` — log enrichment started, succeeded (with duration), partial success (no image), failed (with error), timed out per FR-024

**Checkpoint**: Save a URL with og:image metadata → item returned with title, excerpt, previewImageUrl, enrichmentStatus=succeeded. Save a URL without og:image → title/excerpt populated, previewImageUrl null, enrichmentStatus=pending, async job published.

### Tests for User Story 1 (written alongside Phase 3 implementation)

- [x] T053 Write unit tests for `SyncEnrichmentService` — verify full success (title+excerpt+previewImageUrl → NeedsAsyncFallback=false), partial success (no og:image → NeedsAsyncFallback=true), full failure (timeout → NeedsAsyncFallback=true, Error=null), SSRF blocked (NeedsAsyncFallback=false, Error="URL blocked."). Verify Duration is tracked. Per FR-001 through FR-007, FR-005a
- [x] T054 [P] Write integration test: POST /api/v1/items with URL that has og:title+og:description+og:image → verify 201 response with title, excerpt, previewImageUrl populated, enrichmentStatus=succeeded. Per US1 scenario 1
- [x] T055 [P] Write integration test: POST /api/v1/items with URL that has metadata but no og:image → verify 201 response with title, excerpt populated, previewImageUrl null, enrichmentStatus=pending. Per US1 scenario 2
- [x] T056 [P] Write integration test: POST /api/v1/items with user-provided title and a URL with og:title → verify user-provided title is preserved (not overwritten by enrichment). Per FR-008, C1

---

## Phase 4: User Story 3 — Enrichment Does Not Block on Slow Pages (Priority: P1)

**Goal**: The save request completes within 5s even when the target page is slow or unreachable, gracefully falling back to async processing.

**Independent Test**: Save a URL that takes longer than the sync timeout. Verify response returns within ~5s with `enrichmentStatus=pending` and empty metadata.

### Implementation for User Story 3

- [x] T033 [US3] Verify timeout handling in `SyncEnrichmentService` in `src/Recall.Core.Enrichment.Common/Services/SyncEnrichmentService.cs` — ensure `OperationCanceledException` from master CTS is caught, returns `SyncEnrichmentResult` with all fields null, `NeedsAsyncFallback=true`, `Error=null` (timeout is not an error, just degraded)
- [x] T034 [US3] Verify `ItemService.SaveItemAsync` in `src/Recall.Core.Api/Services/ItemService.cs` persists the item BEFORE calling sync enrichment — ensures the item is never lost even if enrichment times out or the process crashes mid-enrichment

**Checkpoint**: Save a URL to a slow page → response returns within timeout, item saved with enrichmentStatus=pending, async fallback queued.

---

## Phase 5: User Story 6 — SSRF Protection Maintained (Priority: P1)

**Goal**: Sync enrichment enforces the same SSRF protections as the async worker — private IPs, loopback, and non-http(s) schemes are blocked.

**Independent Test**: Save a URL pointing to `http://192.168.1.1/admin`. Verify `enrichmentStatus=failed` with `enrichmentError="URL blocked."` and NO async fallback queued.

### Implementation for User Story 6

- [x] T035 [US6] Verify `SyncEnrichmentService` in `src/Recall.Core.Enrichment.Common/Services/SyncEnrichmentService.cs` catches `SsrfBlockedException` and returns `SyncEnrichmentResult` with `Error="URL blocked."`, `NeedsAsyncFallback=false` — no async fallback for security blocks per enrichment state machine
- [x] T036 [US6] Verify `ItemService.SaveItemAsync` in `src/Recall.Core.Api/Services/ItemService.cs` sets `enrichmentStatus=failed` and `enrichmentError` from result when `result.Error` is set and `result.NeedsAsyncFallback=false`, and does NOT publish async fallback job

**Checkpoint**: Save a SSRF-blocked URL → enrichmentStatus=failed, enrichmentError populated, no async job published.

### Tests for User Story 6 (written alongside Phase 5 implementation)

- [x] T057 [P] Write integration test: POST /api/v1/items with SSRF-blocked URL (http://192.168.1.1) → verify enrichmentStatus=failed, enrichmentError populated, no async job published. Per US6

---

## Phase 6: User Story 2 — Async Screenshot Fallback (Priority: P1)

**Goal**: When sync enrichment cannot obtain a preview image, the async worker captures a headless-browser screenshot as fallback.

**Independent Test**: Save a URL without og:image. Verify async worker runs, captures screenshot, updates item with thumbnailStorageKey and enrichmentStatus=succeeded.

### Implementation for User Story 2

- [ ] T037 [US2] Narrow `EnrichmentService.EnrichAsync` in `src/Recall.Core.Enrichment/Services/EnrichmentService.cs` — when item already has title AND excerpt (populated by sync enrichment), skip HTML fetch/parse and go directly to Playwright screenshot capture. When title/excerpt are null (full sync failure), perform full enrichment (HTML fetch + parse + screenshot) as before
- [ ] T038 [US2] Update `EnrichmentService.EnrichAsync` in `src/Recall.Core.Enrichment/Services/EnrichmentService.cs` — after successful screenshot, if title/excerpt were already populated, set `enrichmentStatus=succeeded`. If screenshot fails but title/excerpt exist, still set `enrichmentStatus=succeeded` (metadata is sufficient). Only set `enrichmentStatus=failed` when both metadata extraction and screenshot fail

> **Note**: T039 was merged into T020 (Phase 2). The `EnrichmentService.cs` import updates to use `Recall.Core.Enrichment.Common.Services` namespace are handled in T020 to ensure the project builds continuously.

**Checkpoint**: Save URL without og:image → sync returns pending → async worker captures screenshot → item updated with thumbnailStorageKey and enrichmentStatus=succeeded.

---

## Phase 7: User Story 4 — Deduplication Unchanged (Priority: P2)

**Goal**: Saving a duplicate URL returns the existing item without triggering any enrichment.

**Independent Test**: Save the same URL twice. Verify the second response returns the existing item (200 OK) without re-fetching metadata or publishing an async job.

### Implementation for User Story 4

- [ ] T040 [US4] Verify `ItemService.SaveItemAsync` in `src/Recall.Core.Api/Services/ItemService.cs` — when deduplication detects existing item, return it immediately WITHOUT calling `ISyncEnrichmentService.EnrichAsync` and WITHOUT publishing async fallback job per FR-015

**Checkpoint**: Save same URL twice → second response is 200 with existing item, no enrichment triggered.

### Tests for User Story 4 (written alongside Phase 7 implementation)

- [ ] T058 [P] Write integration test: POST /api/v1/items with duplicate URL → verify 200 response with existing item, no enrichment triggered. Per US4, FR-015

---

## Phase 8: User Story 5 — Re-enrichment Endpoint Unchanged (Priority: P2)

**Goal**: The re-enrichment endpoint performs sync enrichment first, then queues async screenshot fallback only if needed.

**Independent Test**: Trigger re-enrichment on an existing item. Verify title/excerpt are refreshed synchronously; if no og:image, async screenshot queued.

### Implementation for User Story 5

- [ ] T041 [US5] Update re-enrichment logic in `src/Recall.Core.Api/Services/ItemService.cs` (or the endpoint handler in `src/Recall.Core.Api/Endpoints/`) — reset `enrichmentStatus=pending`, call `ISyncEnrichmentService.EnrichAsync()`, apply results (title/excerpt refreshed, previewImageUrl updated), return result so endpoint can decide on async fallback
- [ ] T041b [US5] Update re-enrichment handler in `src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs` — modify the POST `/api/v1/items/{id}/enrich` handler to publish Dapr async fallback job ONLY when `NeedsAsyncFallback=true`, otherwise skip publish. Set `enrichmentStatus=succeeded` if sync enrichment obtained a preview image per FR-016. Remove the current unconditional publish.
- [ ] T042 [US5] Update `EnrichResponse` in `src/Recall.Core.Api/Models/EnrichResponse.cs` if needed — ensure `status` field reflects post-sync enrichment state (can be `succeeded` if og:image found, `pending` if async fallback queued)

**Checkpoint**: Trigger re-enrichment → title/excerpt refreshed synchronously. If og:image found → succeeded immediately. If not → pending with async fallback queued.

### Tests for User Story 5 (written alongside Phase 8 implementation)

- [ ] T059 Write integration test: POST /api/v1/items/{id}/enrich → verify sync enrichment runs, title/excerpt refreshed, async fallback queued only when no og:image. Per US5, FR-016

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Observability, configuration alignment, and validation

- [ ] T043 [P] Add `Enrichment` configuration section to `src/Recall.Core.Enrichment/appsettings.json` — ensure async worker overrides sync-tuned defaults (e.g., FetchTimeoutSeconds=30) and reads from unified `EnrichmentOptions` in shared library
- [ ] T044 [P] Add OTel metrics for sync enrichment to `SyncEnrichmentService` in `src/Recall.Core.Enrichment.Common/Services/SyncEnrichmentService.cs` — counters: `enrichment.sync.succeeded`, `enrichment.sync.partial` (no image), `enrichment.sync.failed`, `enrichment.sync.ssrf_blocked`; histogram: `enrichment.sync.duration` per FR-025
- [ ] T045 [P] Verify async enrichment metrics in `src/Recall.Core.Enrichment/Services/EnrichmentService.cs` continue to emit per FR-026 after narrowing changes
- [ ] T046 _(Merged into T027 — DTO mapping and endpoint serialization alignment now handled together.)_
- [ ] T047 Code cleanup — remove any remaining dead imports or unused `using` statements across modified files in `src/Recall.Core.Api/`, `src/Recall.Core.Enrichment/`, and `src/Recall.Core.Enrichment.Common/`
- [ ] T048 Run `dotnet build src/RecallCore.sln` and `dotnet test` across all test projects to verify no regressions
- [ ] T049 Run quickstart.md validation — execute all 8 curl scenarios from `specs/008-sync-enrichment/quickstart.md` against running AppHost and verify expected results

---

## Phase 10: Testing Consolidation & Validation

**Purpose**: Verify all tests pass together and validate coverage — constitution §IV compliance is achieved via tests written alongside implementation in earlier phases (see below)

> **Constitution §IV Alignment**: Unit tests (T050–T053) are written alongside their Phase 2/3 implementations. Integration tests (T054–T059) are written alongside their respective user story phases. This phase runs all tests together and validates overall coverage.

- [ ] T060 Run `dotnet test` across all test projects — verify T050–T059 tests all pass together with no regressions
- [ ] T061 Review test coverage for sync enrichment path — ensure shared library unit tests cover >90% branch coverage per Constitution §IV

**Checkpoint**: All unit and integration tests pass. Coverage for shared library services, sync enrichment happy path, SSRF blocking, user-provided value preservation, deduplication, and re-enrichment.

### Test Task Cross-Reference (written alongside implementation)

| Test Task | Written In Phase | Alongside Tasks |
|-----------|-----------------|-----------------|
| T050–T052 (shared lib unit tests) | Phase 2 (Foundational) | T017–T019 (implementations) |
| T053 (SyncEnrichmentService unit tests) | Phase 3 (US1) | T029 (implementation) |
| T054–T056 (API integration: happy path, no-image, user-provided) | Phase 3 (US1) | T030, T030b |
| T057 (API integration: SSRF) | Phase 5 (US6) | T035–T036 |
| T058 (API integration: dedup) | Phase 7 (US4) | T040 |
| T059 (API integration: re-enrichment) | Phase 8 (US5) | T041, T041b |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — BLOCKS all user stories. Includes shared library unit tests (T050–T052)
- **US1 — Instant Enriched Bookmark (Phase 3)**: Depends on Foundational (Phase 2) — this is the MVP. Includes SyncEnrichmentService unit tests (T053) and API integration tests (T054–T056)
- **US3 — Slow Page Handling (Phase 4)**: Depends on US1 (Phase 3) — validates timeout behavior implemented in T029
- **US6 — SSRF Protection (Phase 5)**: Depends on US1 (Phase 3) — validates SSRF handling implemented in T029. Includes SSRF integration test (T057)
- **US2 — Async Screenshot Fallback (Phase 6)**: Depends on Foundational (Phase 2) — modifies async worker independently from sync path
- **US4 — Deduplication Unchanged (Phase 7)**: Depends on US1 (Phase 3) — validates dedup guard skips sync enrichment. Includes dedup integration test (T058)
- **US5 — Re-enrichment Endpoint (Phase 8)**: Depends on US1 (Phase 3) — uses `ISyncEnrichmentService` in re-enrichment flow. Includes re-enrichment integration test (T059)
- **Polish (Phase 9)**: Depends on all user stories being complete
- **Testing Consolidation (Phase 10)**: Runs all tests together (T060–T061) — depends on all earlier phases

### User Story Dependencies

- **US1 (P1)**: Core MVP — implements `SyncEnrichmentService` and integrates into `ItemService`
- **US3 (P1)**: Validates US1 timeout behavior — no new code, primarily verification
- **US6 (P1)**: Validates US1 SSRF behavior — no new code, primarily verification
- **US2 (P1)**: Independent from sync path — modifies only the async `EnrichmentService`
- **US4 (P2)**: Independent validation — verifies existing dedup guard behavior with new sync path
- **US5 (P2)**: Extends US1 — applies sync enrichment to re-enrichment endpoint

### Within Each User Story

- Models before services
- Services before endpoint integration
- Core implementation before observability/logging
- Story complete before moving to next priority

### Parallel Opportunities

- T003 + T004: Project references can be added in parallel
- T009 + T010 + T011: Model creation in parallel (different files)
- T013 + T014 + T015 + T016: Interface creation in parallel (different files)
- T020 + T021 + T022: Cleanup of old files in parallel
- T027: DTO update can parallel with interface work
- Phase 4 (US3) + Phase 5 (US6): Both are verification tasks that can run in parallel after US1
- Phase 6 (US2): Can run in parallel with US3/US6 (modifies different project)
- Phase 9 tasks T043 + T044 + T045 + T046: All touch different files, can run in parallel
- Phase 10 tasks T050 + T051 + T052: Shared library unit tests touch different files, can run in parallel
- Phase 10 tasks T054 + T055 + T056 + T057 + T058: API integration tests touch different test methods, can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch all model files together:
Task T009: "Create PageMetadata in Recall.Core.Enrichment.Common/Models/PageMetadata.cs"
Task T010: "Create SyncEnrichmentResult in Recall.Core.Enrichment.Common/Models/SyncEnrichmentResult.cs"
Task T011: "Create SsrfBlockedException in Recall.Core.Enrichment.Common/Models/SsrfBlockedException.cs"

# Launch all interface files together:
Task T013: "Create ISsrfValidator in Recall.Core.Enrichment.Common/Services/ISsrfValidator.cs"
Task T014: "Create IHtmlFetcher in Recall.Core.Enrichment.Common/Services/IHtmlFetcher.cs"
Task T015: "Create IMetadataExtractor in Recall.Core.Enrichment.Common/Services/IMetadataExtractor.cs"
Task T016: "Create ISyncEnrichmentService in Recall.Core.Enrichment.Common/Services/ISyncEnrichmentService.cs"

# Launch old file cleanups together:
Task T020: "Remove old enrichment service files from Recall.Core.Enrichment/Services/"
Task T021: "Remove old EnrichmentOptions from Recall.Core.Api/Services/"
Task T022: "Remove old EnrichmentOptions from Recall.Core.Enrichment/Services/"
```

## Parallel Example: After US1 Complete

```bash
# These three phases can ALL run in parallel once US1 is done:
Phase 4 (US3): "Verify timeout handling" — touches no new files, verification only
Phase 5 (US6): "Verify SSRF handling" — touches no new files, verification only
Phase 6 (US2): "Narrow async worker" — modifies Recall.Core.Enrichment only

# And independently:
Phase 7 (US4): "Verify deduplication" — verification only
Phase 8 (US5): "Update re-enrichment endpoint" — modifies API endpoint only
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (project creation, solution wiring)
2. Complete Phase 2: Foundational (extract shared library, no behavior changes)
3. Complete Phase 3: User Story 1 — Instant Enriched Bookmark
4. **STOP and VALIDATE**: Save a URL with og:image → fully enriched response. Save without → pending + async fallback.
5. This is a deployable MVP — most bookmarks are now enriched inline.

### Incremental Delivery

1. Setup + Foundational → Shared library extracted, solution builds, existing tests pass
2. US1 → Sync enrichment works for happy path → Deploy/Demo (MVP!)
3. US3 + US6 → Timeout + SSRF verified → Confidence in edge cases
4. US2 → Async worker narrowed → Screenshot fallback works correctly with new flow
5. US4 + US5 → Dedup + re-enrichment verified → Feature complete
6. Polish → Metrics, cleanup, quickstart validation → Production ready

### Parallel Team Strategy

With multiple developers after Foundational is complete:

1. Developer A: US1 (sync enrichment core) → US3 + US6 (verification)
2. Developer B: US2 (async worker narrowing) → US4 (dedup verification)
3. Developer C: US5 (re-enrichment endpoint) → Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- US3, US4, US6 are primarily verification/validation — code changes are minimal (logic is in US1/US2)
- The shared library `Recall.Core.Enrichment.Common` is a class library — NOT registered in AppHost
- No image download in sync path — og:image URL stored directly
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
