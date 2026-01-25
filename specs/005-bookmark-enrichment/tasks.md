```markdown
# Tasks: Bookmark Enrichment

**Input**: Design documents from `/specs/005-bookmark-enrichment/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create new Enrichment microservice project and Dapr component structure

- [x] T001 Create Recall.Core.Enrichment project using ASP.NET Core Web SDK in src/Recall.Core.Enrichment/Recall.Core.Enrichment.csproj
- [x] T002 [P] Add package references to Recall.Core.Enrichment.csproj: Dapr.AspNetCore 1.14.0, Aspire.Azure.Storage.Blobs 13.1.0, Aspire.MongoDB.Driver.v2 13.1.0, AngleSharp 1.1.2, Microsoft.Playwright 1.47.0, SkiaSharp 2.88.8
- [x] T003 [P] Add CommunityToolkit.Aspire.Hosting.Dapr 13.1.0 package to src/Recall.Core.AppHost/Recall.Core.AppHost.csproj
- [x] T004 [P] Add Dapr.AspNetCore 1.14.0 package to src/Recall.Core.Api/Recall.Core.Api.csproj
- [x] T005 [P] Create Dapr pubsub component in src/Recall.Core.AppHost/components/pubsub.yaml (Redis-backed enrichment-pubsub)
- [x] T006 [P] Create Dapr subscription in src/Recall.Core.AppHost/components/subscription.yaml (enrichment.requested topic → /api/enrichment/process, dead letter to enrichment.deadletter)
- [x] T007 [P] Create Dapr resiliency policy in src/Recall.Core.AppHost/components/resiliency.yaml (30s timeout, exponential retry, circuit breaker)
- [x] T008 Add ServiceDefaults project reference to Recall.Core.Enrichment.csproj
- [x] T009 Create basic Program.cs skeleton in src/Recall.Core.Enrichment/Program.cs with AddServiceDefaults, Dapr, and placeholder endpoints

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure changes that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T010 Extend Item entity with enrichment fields (Title, Excerpt, ThumbnailStorageKey, EnrichmentStatus, EnrichmentError, EnrichedAt) in src/Recall.Core.Api/Entities/Item.cs
- [x] T011 Extend ItemDto with enrichment fields (Title, Excerpt, ThumbnailUrl, EnrichmentStatus, EnrichmentError, EnrichedAt) and update FromEntity method in src/Recall.Core.Api/Models/ItemDto.cs
- [x] T012 [P] Create EnrichmentJob record model in src/Recall.Core.Api/Models/EnrichmentJob.cs (ItemId, UserId, Url, EnqueuedAt)
- [x] T013 Update AppHost.cs to add Redis container with .WithLifetime(ContainerLifetime.Persistent) in src/Recall.Core.AppHost/AppHost.cs
- [x] T014 Update AppHost.cs to add Azure Storage emulator for blobs only in src/Recall.Core.AppHost/AppHost.cs
- [x] T015 Update AppHost.cs to add Enrichment project with Dapr sidecar (.WithDaprSidecar) in src/Recall.Core.AppHost/AppHost.cs
- [x] T016 Update AppHost.cs to add Dapr sidecar to API project in src/Recall.Core.AppHost/AppHost.cs
- [x] T017 [P] Add enrichmentStatus filter parameter to GET /api/v1/items query in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [x] T018 Add DaprClient registration in src/Recall.Core.Api/Program.cs (builder.Services.AddDaprClient)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1+4 - Fast Bookmark Save with Background Enrichment + SSRF Protection (Priority: P1) 🎯 MVP

**Goal**: When user creates a bookmark, it saves immediately with pending status and enrichment runs asynchronously in background with SSRF protection

**Independent Test**: Save a URL via POST /items, verify immediate 201 response with enrichmentStatus=pending, wait 5-10 seconds, GET the item and verify title/excerpt/thumbnailUrl populated (or enrichmentStatus=failed for bad URLs)

### Implementation for User Story 1+4

- [ ] T019 [US1] Inject DaprClient into ItemsEndpoints and publish enrichment.requested event after item creation in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T020 [US1] Set enrichmentStatus=pending for newly created items in POST /items endpoint in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T021 [P] [US1] Create IEnrichmentService interface in src/Recall.Core.Enrichment/Services/IEnrichmentService.cs
- [ ] T022 [P] [US1] Create ISsrfValidator interface in src/Recall.Core.Enrichment/Services/ISsrfValidator.cs
- [ ] T023 [P] [US1] Create IHtmlFetcher interface in src/Recall.Core.Enrichment/Services/IHtmlFetcher.cs
- [ ] T024 [P] [US1] Create IMetadataExtractor interface in src/Recall.Core.Enrichment/Services/IMetadataExtractor.cs
- [ ] T025 [P] [US1] Create IThumbnailGenerator interface in src/Recall.Core.Enrichment/Services/IThumbnailGenerator.cs
- [ ] T026 [P] [US1] Create IThumbnailStorage interface in src/Recall.Core.Enrichment/Storage/IThumbnailStorage.cs
- [ ] T027 [US4] Implement SsrfValidator with IP range blocking (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, fc00::/7, fe80::/10) in src/Recall.Core.Enrichment/Services/SsrfValidator.cs
- [ ] T028 [US1] Implement HtmlFetcher with SSRF validation, timeout (10s connect, 30s total), size limit (5MB), redirect limit (3) in src/Recall.Core.Enrichment/Services/HtmlFetcher.cs
- [ ] T029 [US1] Implement MetadataExtractor using AngleSharp (og:title → title → h1, og:description → meta description → first p, og:image) in src/Recall.Core.Enrichment/Services/MetadataExtractor.cs
- [ ] T030 [US1] Implement ThumbnailGenerator with og:image download via HtmlFetcher, SkiaSharp resize (600x400, JPEG 80%), and Playwright fallback screenshot (sandbox mode enabled per FR-023) in src/Recall.Core.Enrichment/Services/ThumbnailGenerator.cs
- [ ] T031 [US1] Implement BlobThumbnailStorage using Azure Blob Storage (container: thumbnails, key: {userId}/{itemId}.jpg) in src/Recall.Core.Enrichment/Storage/BlobThumbnailStorage.cs
- [ ] T032 [US1] Implement EnrichmentService orchestrating fetch → extract → generate thumbnail → update item in src/Recall.Core.Enrichment/Services/EnrichmentService.cs
- [ ] T033 [US1] Create EnrichmentController with [Topic("enrichment-pubsub", "enrichment.requested")] subscriber endpoint in src/Recall.Core.Enrichment/Controllers/EnrichmentController.cs
- [ ] T034 [US1] Add dead letter handler [Topic("enrichment-pubsub", "enrichment.deadletter")] to mark items as failed in src/Recall.Core.Enrichment/Controllers/EnrichmentController.cs
- [ ] T035 [US1] Register all services in Program.cs and configure Dapr subscriber (UseCloudEvents, MapControllers, MapSubscribeHandler) in src/Recall.Core.Enrichment/Program.cs
- [ ] T036 [US1] Add IItemsRepository method UpdateEnrichmentResultAsync(itemId, title, excerpt, thumbnailKey, status, error, enrichedAt) in src/Recall.Core.Api/Repositories/IItemsRepository.cs
- [ ] T037 [US1] Implement UpdateEnrichmentResultAsync in ItemsRepository with MongoDB update in src/Recall.Core.Api/Repositories/ItemsRepository.cs
- [ ] T038 [US1] Add structured logging for enrichment job lifecycle (queued, started, succeeded, failed) in src/Recall.Core.Enrichment/Controllers/EnrichmentController.cs
- [ ] T039 [US1] Add OpenTelemetry metrics (enrichment.jobs.succeeded, enrichment.jobs.failed, enrichment.jobs.duration) in src/Recall.Core.Enrichment/Services/EnrichmentService.cs

**Checkpoint**: Core enrichment pipeline complete - items are saved fast, enrichment runs async, SSRF is blocked

---

## Phase 4: User Story 2 - View Enriched Bookmarks (Priority: P1)

**Goal**: Users see title, excerpt, thumbnailUrl, and enrichmentStatus when listing or getting items

**Independent Test**: Create multiple items, wait for enrichment, GET /items and verify all items show enrichment fields in response

### Implementation for User Story 2

- [ ] T040 [US2] Verify GET /api/v1/items returns ItemDto with enrichment fields (title, excerpt, thumbnailUrl, enrichmentStatus, enrichmentError, enrichedAt) in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T041 [US2] Verify GET /api/v1/items/{id} returns ItemDto with enrichment fields in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T042 [US2] Update ItemDto.FromEntity to compute thumbnailUrl from ThumbnailStorageKey as /api/v1/items/{id}/thumbnail in src/Recall.Core.Api/Models/ItemDto.cs

**Checkpoint**: API returns enrichment fields - users can see enriched content

---

## Phase 5: User Story 3 - Secure Thumbnail Access (Priority: P1)

**Goal**: Thumbnail endpoint returns image only to authenticated owner, 404 for others

**Independent Test**: As User A, save item → verify thumbnail accessible. As User B, attempt same thumbnail → expect 404. Unauthenticated → expect 401.

### Implementation for User Story 3

- [ ] T043 [US3] Create GET /api/v1/items/{id}/thumbnail endpoint returning image/jpeg from blob storage in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T044 [US3] Add ownership check in thumbnail endpoint (return 404 if item.UserId != currentUserId or thumbnail not available) in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T045 [US3] Add IThumbnailStorage interface and BlobThumbnailStorage in API project for thumbnail retrieval in src/Recall.Core.Api/Services/BlobThumbnailStorage.cs
- [ ] T046 [US3] Register BlobThumbnailStorage in API Program.cs in src/Recall.Core.Api/Program.cs
- [ ] T047 [US3] Add AddAzureBlobServiceClient("blobs") in API Program.cs in src/Recall.Core.Api/Program.cs

**Checkpoint**: Thumbnails securely accessible only by owning user

---

## Phase 6: User Story 5 - Retry Failed Enrichment (Priority: P2)

**Goal**: Users can manually trigger re-enrichment for failed or stale items

**Independent Test**: Create item that fails enrichment (e.g., bad URL), verify enrichmentStatus=failed, POST /items/{id}/enrich, verify status becomes pending and eventually updates

### Implementation for User Story 5

- [ ] T048 [US5] Create POST /api/v1/items/{id}/enrich endpoint in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T049 [US5] Implement enrich endpoint logic: verify ownership, set status=pending, publish enrichment.requested event, return 202 Accepted in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T050 [US5] Create EnrichResponse model (message, itemId, status) in src/Recall.Core.Api/Models/EnrichResponse.cs

**Checkpoint**: Users can retry failed enrichment

---

## Phase 7: User Story 6 - Deduplication Does Not Re-Enrich (Priority: P2)

**Goal**: When saving a URL that already exists, return existing item without new enrichment job

**Independent Test**: Save URL once → verify enrichment enqueued. Save same URL again → verify same item returned with no new enrichment job logged

### Implementation for User Story 6

- [ ] T051 [US6] Modify POST /items to skip DaprClient.PublishEventAsync when returning existing item (deduplication path) in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T052 [US6] Add logging to distinguish new item creation from deduplication return in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs

**Checkpoint**: Deduplication returns existing item without re-enrichment

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, documentation, and validation

- [ ] T053 [P] Add OpenAPI documentation tags and descriptions for new endpoints in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [ ] T054 [P] Create appsettings.json for Enrichment project with configuration (ThumbnailContainer, timeouts) in src/Recall.Core.Enrichment/appsettings.json
- [ ] T055 [P] Update frontend ItemDto type to include enrichment fields in src/web/src/features/items/types.ts (if applicable)
- [ ] T056 [P] Add index on (userId, enrichmentStatus) in MongoDB initialization in src/Recall.Core.Api/Repositories/IndexInitializer.cs (if exists)
- [ ] T057 Run quickstart.md validation: start application, create item, verify enrichment completes
- [ ] T058 [P] Update copilot-instructions.md with enrichment-related patterns and conventions in .github/copilot-instructions.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US1+US4 (Phase 3)**: Depends on Foundational - Core MVP
- **US2 (Phase 4)**: Depends on Phase 2 (ItemDto changes) - Can start after Foundational
- **US3 (Phase 5)**: Depends on Phase 3 (thumbnails exist in storage) - Needs enrichment working
- **US5 (Phase 6)**: Depends on Phase 3 (enrichment infrastructure) - Needs publish mechanism
- **US6 (Phase 7)**: Depends on Phase 3 (deduplication needs publish to conditionally skip)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

| Story | Priority | Depends On | Can Start After |
|-------|----------|------------|-----------------|
| US1+US4 (Core Enrichment + SSRF) | P1 | Foundational | Phase 2 complete |
| US2 (View Enriched) | P1 | Foundational | Phase 2 complete (parallel with US1) |
| US3 (Thumbnail Endpoint) | P1 | US1 (thumbnails must exist) | Phase 3 complete |
| US5 (Retry Enrichment) | P2 | US1 (enrichment infra) | Phase 3 complete |
| US6 (Deduplication) | P2 | US1 (publish mechanism) | Phase 3 complete |

### Parallel Opportunities

**Phase 1 (Setup)**:
```
T002, T003, T004, T005, T006, T007 can all run in parallel
```

**Phase 3 (US1+US4)**:
```
T021, T022, T023, T024, T025, T026 (interfaces) can all run in parallel
Then T027-T031 (implementations) can run in parallel
```

**Phase 8 (Polish)**:
```
T053, T054, T055, T056, T058 can all run in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1+US4 (Core Enrichment + SSRF)
4. **STOP and VALIDATE**: Create item, verify enrichment runs, check logs
5. Deploy/demo if ready - Users can save bookmarks with automatic enrichment

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1+US4 → Core enrichment works → **MVP!**
3. Add US2 → API returns enrichment fields → Users see rich content
4. Add US3 → Thumbnail endpoint → Users see images
5. Add US5 → Re-enrichment → Users can retry
6. Add US6 → Deduplication verified → Clean behavior
7. Polish → Production ready

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 58 |
| **Setup Tasks** | 9 |
| **Foundational Tasks** | 9 |
| **US1+US4 Tasks** | 21 |
| **US2 Tasks** | 3 |
| **US3 Tasks** | 5 |
| **US5 Tasks** | 3 |
| **US6 Tasks** | 2 |
| **Polish Tasks** | 6 |
| **Parallel Tasks** | 24 |
| **MVP Scope** | Phase 1 + Phase 2 + Phase 3 (39 tasks) |

---

## Notes

- All enrichment service classes use interfaces for testability
- Dapr Pub/Sub replaces direct queue access per constitution mandate
- SSRF protection is baked into US1 (SsrfValidator integrated into HtmlFetcher)
- Thumbnails stored in blob storage, accessed via API endpoint for security
- Frontend changes (T055) are optional if frontend not actively developed
- Playwright browser installation required during CI/CD or first run

```
