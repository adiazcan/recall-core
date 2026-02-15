# Tasks: Tag Entity Refactor

**Input**: Design documents from `/specs/009-tag-entity-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Test tasks are included — the spec requires integration tests for data isolation (FR-018, FR-019), migration idempotency (FR-014), and the existing codebase has test patterns for endpoint and auth tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Tag entity, normalization utility, and DTOs that all user stories depend on

- [ ] T001 [P] Create Tag entity in `src/Recall.Core.Api/Entities/Tag.cs` — ObjectId Id, string DisplayName, string NormalizedName, string? Color, string UserId, DateTime CreatedAt, DateTime UpdatedAt with `[BsonElement]` attributes and `[BsonIgnoreExtraElements]` per data-model.md
- [ ] T002 [P] Create TagNormalizer static utility in `src/Recall.Core.Api/Services/TagNormalizer.cs` — `Normalize(string displayName)` returns `Trim().ToLowerInvariant()`, throws on empty or >50 chars, exposes `MaxLength = 50` constant per research.md decision 1
- [ ] T003 [P] Create tag DTO records in `src/Recall.Core.Api/Models/TagDto.cs` — TagDto(Id, DisplayName, NormalizedName, Color, ItemCount, CreatedAt, UpdatedAt) with `FromEntity` factory method, TagSummaryDto(Id, Name, Color), TagDeleteResponse(Id, ItemsUpdated) per contracts/openapi.yaml schemas
- [ ] T004 [P] Create tag request models: CreateTagRequest(Name, Color?) in `src/Recall.Core.Api/Models/CreateTagRequest.cs` and UpdateTagRequest(Name?, Color?) in `src/Recall.Core.Api/Models/UpdateTagRequest.cs` per contracts/openapi.yaml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repository, service, and DI wiring that MUST be complete before any user story endpoints can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create ITagRepository interface in `src/Recall.Core.Api/Repositories/ITagRepository.cs` — CreateAsync, GetByIdAsync, GetByNormalizedNameAsync, GetByIdsAsync, ListAsync (with q/cursor/limit), UpdateAsync, DeleteAsync — all methods accept userId as first parameter per data-model.md
- [ ] T006 Implement TagRepository in `src/Recall.Core.Api/Repositories/TagRepository.cs` — MongoDB `tags` collection, create unique compound index `{ userId: 1, normalizedName: 1 }` on startup, handle `MongoWriteException` DuplicateKey in CreateAsync by returning existing tag per research.md decision 2, cursor-based alphabetical pagination in ListAsync, all queries filter by userId
- [ ] T007 Create ITagService interface in `src/Recall.Core.Api/Services/ITagService.cs` and implement TagService in `src/Recall.Core.Api/Services/TagService.cs` — CreateAsync (normalize name, validate color, delegate to repository, return 201/200 based on duplicate), GetByIdAsync (fetch tag + item count via aggregation), ListAsync (with counts via IItemRepository.GetTagIdCountsAsync), UpdateAsync (rename conflict check → 409, unique index catch), DeleteAsync (call IItemRepository.RemoveTagIdFromItemsAsync then delete tag)
- [ ] T008 Add TagIdCount record and new methods to IItemRepository in `src/Recall.Core.Api/Repositories/IItemRepository.cs` — `GetTagIdCountsAsync(string userId)` returning `IReadOnlyList<TagIdCount>`, `RemoveTagIdFromItemsAsync(string userId, ObjectId tagId)` returning modified count. Implement in `src/Recall.Core.Api/Repositories/ItemRepository.cs` using `$unwind/$group` aggregation on tagIds for counts and `$pull` for removal per research.md decisions 4 and 8
- [ ] T009 Register ITagRepository/TagRepository (singleton) and ITagService/TagService (scoped) in DI container in `src/Recall.Core.Api/Program.cs`
- [ ] T010 Verify `dotnet build src/RecallCore.sln` succeeds after all foundational changes

**Checkpoint**: Tag repository and service ready. Solution builds. No new endpoints yet — infrastructure only.

---

## Phase 3: User Story 1 — Tag CRUD Management (Priority: P1) 🎯 MVP

**Goal**: Users can create, list, search, rename, and delete tags as independent entities via the API.

**Independent Test**: Create tags via POST, list with item counts via GET, rename via PATCH (verify 409 on conflict), delete via DELETE (verify itemsUpdated count). Verify 404 for cross-user access.

### Implementation for User Story 1

- [ ] T011 [US1] Rewrite TagsEndpoints.cs in `src/Recall.Core.Api/Endpoints/TagsEndpoints.cs` — remove all existing name-based endpoints, implement ID-based CRUD: POST `/api/v1/tags` (201 Created / 200 OK idempotent), GET `/api/v1/tags` (list with `q`, `cursor`, `limit` params, returns TagListResponse), GET `/api/v1/tags/{id}` (single tag with item count), PATCH `/api/v1/tags/{id}` (rename/color update, 409 Conflict on duplicate normalized name), DELETE `/api/v1/tags/{id}` (200 with TagDeleteResponse). Use `.WithTags("Tags")` and `.RequireAuthorization("ApiScope")` per contracts/openapi.yaml

### Tests for User Story 1

- [ ] T012 [P] [US1] Write integration tests for Tag CRUD in `src/tests/Recall.Core.Api.Tests/Endpoints/TagsEndpointTests.cs` — test scenarios: create tag (201 with all fields), duplicate tag returns existing (200), create with color, list tags with item counts, search by prefix (`q=java`), get by ID (200), get non-existent (404), rename tag (200), rename to conflicting name (409), delete tag (200 with itemsUpdated), delete non-existent (404), validate name constraints (empty, >50 chars → 400)
- [ ] T013 [P] [US1] Write tag data isolation tests in `src/tests/Recall.Core.Api.Tests/Auth/DataIsolationTests.cs` — user A creates tags, user B cannot list/get/rename/delete them (expect 404 per FR-019), user B's tag list is empty, tag creation with same name by different users succeeds independently per FR-018

**Checkpoint**: Tag CRUD fully functional — create, list, search, rename, delete all work via API. Data isolation verified. This is the MVP.

---

## Phase 4: User Story 2 — Item Tagging with Tag References (Priority: P1)

**Goal**: Items reference tags by ID instead of by name. Item create/update accepts `tagIds` + `newTagNames`. Item responses expand tag IDs to full tag details. Item list supports `tagId` filter.

**Independent Test**: Create item with `tagIds` → response has expanded tags. Create item with `newTagNames` → new Tag entities created + referenced. Rename a tag → item response reflects new name without item update. Filter items by `tagId`.

### Implementation for User Story 2

- [ ] T014 [US2] Modify Item entity in `src/Recall.Core.Api/Entities/Item.cs` — add `TagIds` property: `List<ObjectId>` with `[BsonElement("tagIds")]` defaulting to empty list. Keep existing `Tags: List<string>` temporarily for migration compatibility per data-model.md
- [ ] T015 [P] [US2] Modify request models: update CreateItemRequest in `src/Recall.Core.Api/Models/CreateItemRequest.cs` — remove `Tags: IReadOnlyList<string>?`, add `TagIds: IReadOnlyList<string>?` and `NewTagNames: IReadOnlyList<string>?`. Apply same changes to UpdateItemRequest in `src/Recall.Core.Api/Models/UpdateItemRequest.cs` per contracts/openapi.yaml
- [ ] T016 [US2] Modify ItemDto in `src/Recall.Core.Api/Models/ItemDto.cs` — change `Tags` property from `IReadOnlyList<string>` to `IReadOnlyList<TagSummaryDto>`, update `FromEntity` mapping to accept an `IReadOnlyList<TagSummaryDto>` parameter for expanded tags
- [ ] T017 [US2] Modify IItemRepository and ItemRepository in `src/Recall.Core.Api/Repositories/IItemRepository.cs` and `src/Recall.Core.Api/Repositories/ItemRepository.cs` — change `ItemListQuery.Tag` (string) to `TagId` (ObjectId?), update filter logic to use `AnyEq` on `tagIds` array, add `{ userId: 1, tagIds: 1 }` multikey index creation in EnsureIndexes per research.md decision 9
- [ ] T018 [US2] Modify ItemService in `src/Recall.Core.Api/Services/ItemService.cs` — replace `NormalizeTags` with tag ID resolution: validate `TagIds` via ITagRepository.GetByIdsAsync (filter to user-owned), process `NewTagNames` via ITagService.CreateAsync (find-or-create), combine and deduplicate ObjectId lists, enforce max 50 tags per item (FR-011). Add batch tag expansion for item reads: collect all tagIds across page, single `$in` query via ITagRepository.GetByIdsAsync, build dictionary, map to TagSummaryDto per research.md decision 3
- [ ] T019 [US2] Modify ItemsEndpoints in `src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs` — POST `/api/v1/items` accepts `tagIds` + `newTagNames`, GET `/api/v1/items` replaces `tag` query param with `tagId`, all item responses include expanded `TagSummaryDto[]` in the tags field, GET `/api/v1/items/{id}` expands tags, PATCH `/api/v1/items/{id}` accepts `tagIds` + `newTagNames` per contracts/openapi.yaml

### Tests for User Story 2

- [ ] T020 [P] [US2] Update item endpoint integration tests in `src/tests/Recall.Core.Api.Tests/Endpoints/ItemsEndpointTests.cs` — test scenarios: create item with tagIds (verify expanded tags in response), create item with newTagNames (verify new Tag entities created and referenced), create item with both tagIds + newTagNames, get item (verify expanded TagSummaryDto[]), update item tags (replace entire list), filter items by tagId, remove all tags (tagIds: []), exceed 50 tags (400), invalid tagId silently ignored, tag rename reflected in item response without item update per US2 acceptance scenarios 1-5

**Checkpoint**: Items reference tags by ID. Batch tag expansion works (no N+1). Tag rename propagation verified. Item CRUD with tag references fully tested.

---

## Phase 5: User Story 3 — Data Migration from Embedded Tags (Priority: P1)

**Goal**: Migrate existing items from `tags: string[]` to `tagIds: ObjectId[]` with Tag entity creation, deduplication, JSON export for rollback.

**Independent Test**: Run migration on items with embedded tags (including case variants). Verify single Tag entity per normalized name, items reference correct tagIds, idempotent re-run, rollback restores original state.

### Implementation for User Story 3

- [ ] T021 [US3] Implement TagMigrationService in `src/Recall.Core.Api/Migration/TagMigrationService.cs` — cursor-based batch processing (100 items per batch): query items where `tags.length > 0 && (tagIds == null || tagIds.length == 0)`, collect unique `(userId, normalizedTag)` pairs, upsert Tag entities via `FindOneAndUpdate` with `upsert: true` (display name from first occurrence per FR-013), map tag strings → tagIds, update items, export mapping to JSON per research.md decision 5. Support `--dry-run` mode (no writes). Record metrics: itemsProcessed, tagsCreated, duplicatesMerged, itemsUpdated, itemsSkipped, errors per FR-017. Handle >50 char tags by truncating with warning. Implement rollback method: read JSON export → restore items.tags from originalTags → clear items.tagIds per FR-015, FR-016
- [ ] T022 [US3] Implement TagMigrationRunner in `src/Recall.Core.Api/Migration/TagMigrationRunner.cs` — CLI entry point for `dotnet run -- migrate-tags` with flags: `--export-path <path>` (default: ./migration-export.json), `--dry-run`, `--rollback`, `--import-path <path>`. Print metrics summary on completion. Wire into Program.cs args handling per quickstart.md migration commands

### Tests for User Story 3

- [ ] T023 [P] [US3] Write migration tests in `src/tests/Recall.Core.Api.Tests/Migration/TagMigrationTests.cs` — test scenarios: basic migration (embedded tags → tagIds), deduplication (["JavaScript", "javascript", "JAVASCRIPT"] → single Tag per FR-013), empty tags skipped, multi-user isolation (each user gets own tags per acceptance scenario 2), idempotency (run twice, no duplicates per FR-014), rollback restores original tags and clears tagIds per FR-016, >50 char tag truncation with warning, export JSON format validation per FR-015

**Checkpoint**: Migration converts embedded tags to tag references. Idempotent. Rollback works. Export format correct.

---

## Phase 6: User Story 4 — Tag Management UI (Priority: P2)

**Goal**: Web app has a tag management screen with list/rename/delete, and item forms use a searchable tag picker with inline creation.

**Independent Test**: Navigate to tag management screen → see all tags with item counts. Rename a tag inline → list updates. Delete a tag → confirmation → removed. Use tag picker on item form → search, select, inline create.

### Implementation for User Story 4

- [ ] T024 [P] [US4] Update frontend types in `src/web/src/types/entities.ts` — replace `Tag` interface with `{ id: string; displayName: string; normalizedName: string; color: string | null; itemCount: number; createdAt: string; updatedAt: string }`, add `TagSummary` interface `{ id: string; name: string; color: string | null }`, modify `Item.tags` from `string[]` to `TagSummary[]` per data-model.md frontend types
- [ ] T025 [P] [US4] Rewrite tags API client in `src/web/src/lib/api/tags.ts` — `createTag(name, color?)`, `listTags(q?, cursor?, limit?)`, `getTag(id)`, `updateTag(id, name?, color?)`, `deleteTag(id)` all ID-based, return types match TagDto/TagListResponse/TagDeleteResponse per contracts/openapi.yaml
- [ ] T026 [P] [US4] Modify items API client in `src/web/src/lib/api/items.ts` — `createItem` accepts `tagIds` + `newTagNames` instead of `tags`, `listItems` accepts `tagId` instead of `tag`, response types use `TagSummary[]` for item tags
- [ ] T027 [US4] Rewrite tags Zustand store in `src/web/src/features/tags/store.ts` — ID-based state management: tags Map<string, Tag>, createTag, updateTag, deleteTag, listTags (with search/pagination), integrate with rewritten tags API client
- [ ] T028 [US4] Create useTagSearch hook in `src/web/src/features/tags/hooks/useTagSearch.ts` — debounced search (300ms default) calling tagsApi.listTags with `q` parameter, returns `{ query, setQuery, results, isLoading }` per research.md decision 7
- [ ] T029 [US4] Create TagPicker component in `src/web/src/features/tags/components/TagPicker.tsx` — input with dropdown suggestions from useTagSearch, selectable tag chips, "Create 'xyz'" option when no exact match, manages selected tags as Tag[] with IDs, keyboard accessible (arrow keys + Enter for selection), Tailwind CSS styling, WCAG 2.1 AA per FR-021
- [ ] T030 [US4] Create TagManagement component in `src/web/src/features/tags/components/TagManagement.tsx` — list all tags with displayName and itemCount sorted alphabetically, inline rename (click to edit), delete with confirmation dialog, empty state with guidance on creating tags per FR-020, acceptance scenario 1-4
- [ ] T031 [US4] Create TagManagementPage in `src/web/src/pages/TagManagementPage.tsx` and update routes in `src/web/src/routes.tsx` — add `/tags/manage` route for tag management screen, update existing `/tags/:name` route to `/tags/:id` for tag-filtered item views
- [ ] T032 [US4] Update existing item components in `src/web/src/features/items/components/` — integrate TagPicker for tag selection on item create/edit forms (replacing free-text tag input), display `TagSummary[]` as visual chips with color support using TagChip component per FR-022
- [ ] T033 [P] [US4] Update TagChip and TagList components in `src/web/src/features/tags/components/TagChip.tsx` and `src/web/src/features/tags/components/TagList.tsx` — accept Tag/TagSummary objects instead of string names, support color display, use tag ID for navigation links

### Tests for User Story 4

- [ ] T034 [P] [US4] Add frontend tests with Vitest — TagPicker component tests (search suggestions, select tag, inline create, keyboard navigation), TagManagement tests (list render, rename, delete confirmation), tags store tests (CRUD operations), useTagSearch hook tests (debounce, results) in `src/web/src/features/tags/` test files per testing guidelines

**Checkpoint**: Tag management screen works. Item forms use tag picker with search + inline creation. Frontend fully updated with ID-based tag model.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, validation, and cross-cutting improvements

- [ ] T035 [P] Code cleanup — remove unused `NormalizeTags` method from `src/Recall.Core.Api/Services/ItemService.cs`, remove any legacy tag string handling code that is no longer needed after tag ID migration path is confirmed, clean up unused imports across modified files
- [ ] T036 [P] Verify items Zustand store in `src/web/src/features/items/store.ts` works correctly with new tagIds + newTagNames API and TagSummary[] responses — update any remaining string-based tag references
- [ ] T037 Verify `dotnet build src/RecallCore.sln` and `dotnet test` across all test projects pass with no regressions
- [ ] T038 Add response time assertions to Tag CRUD integration tests in `src/tests/Recall.Core.Api.Tests/Endpoints/TagsEndpointTests.cs` — verify POST, PATCH, DELETE `/api/v1/tags` complete in <3s per SC-002. Use `Stopwatch` around HTTP calls and `Assert.True(elapsed < TimeSpan.FromSeconds(3))` for each operation
- [ ] T039 Run quickstart.md validation — execute all 13 curl scenarios from `specs/009-tag-entity-refactor/quickstart.md` against running AppHost and verify expected results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — BLOCKS all user stories
- **US1 — Tag CRUD (Phase 3)**: Depends on Foundational (Phase 2) — this is the MVP
- **US2 — Item Tagging (Phase 4)**: Depends on US1 (Phase 3) — needs Tag CRUD working to validate/resolve tag IDs
- **US3 — Migration (Phase 5)**: Depends on Foundational (Phase 2) — uses TagRepository to upsert tags. Can run in parallel with US1/US2 but should be tested after US2 is complete
- **US4 — UI (Phase 6)**: Depends on US1 (Phase 3) and US2 (Phase 4) — frontend consumes the ID-based API
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundation — creates Tag CRUD API. Can start after Phase 2.
- **US2 (P1)**: Core integration — modifies Items to use tag references. Depends on US1 (needs TagService for validation/creation).
- **US3 (P1)**: Data transition — migrates embedded tags. Depends on Phase 2 (TagRepository). Independent of US1/US2 endpoints but should validate against US2's item model.
- **US4 (P2)**: User-facing UI — consumes US1 + US2 APIs. Depends on both being complete.

### Within Each User Story

- Entity/model changes before repository/service changes
- Repository before service
- Service before endpoints
- Endpoints before tests (tests validate the full stack)
- Core implementation before integration

### Parallel Opportunities

- T001 + T002 + T003 + T004: All setup tasks create different files, can run in parallel
- T012 + T013: Tag test files are independent, can run in parallel
- T015: Request model changes can parallel with other US2 work (different files)
- T020: Item tests can parallel with other US2 implementation
- T023: Migration tests can parallel with migration implementation (TDD)
- T024 + T025 + T026: Frontend types, tags API, items API are independent files
- T033 + T034: TagChip/TagList updates and frontend tests are independent
- T035 + T036: Cleanup tasks touch different areas

---

## Parallel Example: Setup Phase

```bash
# Launch all setup tasks together (different files):
Task T001: "Create Tag entity in src/Recall.Core.Api/Entities/Tag.cs"
Task T002: "Create TagNormalizer in src/Recall.Core.Api/Services/TagNormalizer.cs"
Task T003: "Create tag DTOs in src/Recall.Core.Api/Models/TagDto.cs"
Task T004: "Create request models in src/Recall.Core.Api/Models/CreateTagRequest.cs + UpdateTagRequest.cs"
```

## Parallel Example: Frontend Phase (US4)

```bash
# Launch all frontend foundation tasks together (different files):
Task T024: "Update types in src/web/src/types/entities.ts"
Task T025: "Rewrite tags API in src/web/src/lib/api/tags.ts"
Task T026: "Modify items API in src/web/src/lib/api/items.ts"

# Then sequentially: store → hook → components → page
Task T027: "Rewrite tags store" (depends on T025)
Task T028: "Create useTagSearch hook" (depends on T025)
Task T029: "Create TagPicker" (depends on T028)
Task T030: "Create TagManagement" (depends on T027)
Task T031: "Create TagManagementPage + routes" (depends on T030)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (entity, normalizer, DTOs)
2. Complete Phase 2: Foundational (repository, service, DI)
3. Complete Phase 3: User Story 1 — Tag CRUD
4. **STOP and VALIDATE**: Create/list/rename/delete tags via API. Data isolation verified.
5. This is a deployable MVP — tags exist as entities with full CRUD.

### Incremental Delivery

1. Setup + Foundational → Entity and infrastructure ready, solution builds
2. US1 → Tag CRUD works → Deploy/Demo (MVP!)
3. US2 → Items reference tags by ID, batch expansion, inline creation → Deploy/Demo
4. US3 → Migration converts existing data → Run migration
5. US4 → Tag management screen + tag picker → Deploy/Demo (feature complete)
6. Polish → Cleanup, quickstart validation → Production ready

### Parallel Team Strategy

With multiple developers after Foundational is complete:

1. Developer A: US1 (Tag CRUD endpoints + tests) → US2 (Item tagging)
2. Developer B: US3 (Migration service) → can start after Phase 2
3. Developer C: US4 (Frontend) → starts after US1 + US2 are complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tag rename propagation is O(1) — only the Tag document changes (items reference by ID)
- Batch tag expansion uses single `$in` query per page — no N+1 queries
- Migration is idempotent and supports rollback via JSON export
- Legacy `Tags: List<string>` on Item kept temporarily — removed after migration confirmed
- API is a breaking change (v1.2.0 → v1.3.0) — all consumers updated in same release
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
