# Tasks: Items, Tags, and Collections API

**Input**: Design documents from `/specs/002-items-tags-collections-api/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/openapi.yaml ✓

**Tests**: Tests are included based on xUnit + Testcontainers pattern from research.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Per plan.md structure:
- **API**: `src/Recall.Core.Api/`
- **Tests**: `src/tests/Recall.Core.Api.Tests/`
- **AppHost**: `src/Recall.Core.AppHost/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, MongoDB integration, and shared models/DTOs

- [x] T001 Add Aspire.MongoDB.Driver.v2 package to src/Recall.Core.Api/Recall.Core.Api.csproj
- [x] T002 Add Testcontainers.MongoDb package to src/tests/Recall.Core.Api.Tests/Recall.Core.Api.Tests.csproj
- [x] T003 Configure MongoDB client registration in src/Recall.Core.Api/Program.cs using AddMongoDBClient("recalldb")
- [x] T004 Update src/Recall.Core.AppHost/AppHost.cs to wire MongoDB reference to API

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Shared Models & Entities

- [x] T005 [P] Create error response DTOs in src/Recall.Core.Api/Models/ErrorResponse.cs (ErrorResponse, ErrorDetail records)
- [x] T006 [P] Create Item entity in src/Recall.Core.Api/Entities/Item.cs with all fields from data-model.md
- [x] T007 [P] Create Collection entity in src/Recall.Core.Api/Entities/Collection.cs with all fields from data-model.md
- [x] T008 [P] Create pagination models (CursorPagination helper) in src/Recall.Core.Api/Models/Pagination.cs

### URL Normalization & Validation

- [x] T009 Create UrlNormalizer utility in src/Recall.Core.Api/Services/UrlNormalizer.cs per research.md rules

### MongoDB Indexes & Bootstrap

- [x] T010 Create IndexInitializer hosted service in src/Recall.Core.Api/Services/IndexInitializer.cs to create indexes on startup

### Test Infrastructure

- [x] T011 Create MongoDbFixture test fixture in src/tests/Recall.Core.Api.Tests/TestFixtures/MongoDbFixture.cs using Testcontainers

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Save a URL for Later (Priority: P1) 🎯 MVP

**Goal**: Enable users to save URLs with optional title/tags, with automatic deduplication

**Independent Test**: POST /api/v1/items with a valid URL returns 201 with saved item; duplicate returns 200 with existing item

### DTOs for User Story 1

- [x] T012 [P] [US1] Create CreateItemRequest DTO in src/Recall.Core.Api/Models/CreateItemRequest.cs
- [x] T013 [P] [US1] Create ItemDto response model in src/Recall.Core.Api/Models/ItemDto.cs

### Repository Layer for User Story 1

- [x] T014 [P] [US1] Create IItemRepository interface in src/Recall.Core.Api/Repositories/IItemRepository.cs
- [x] T015 [US1] Implement ItemRepository in src/Recall.Core.Api/Repositories/ItemRepository.cs with FindByNormalizedUrl, InsertAsync methods

### Service Layer for User Story 1

- [x] T016 [P] [US1] Create IItemService interface in src/Recall.Core.Api/Services/IItemService.cs
- [x] T017 [US1] Implement ItemService.SaveItemAsync in src/Recall.Core.Api/Services/ItemService.cs with deduplication logic

### Endpoint for User Story 1

- [x] T018 [US1] Create ItemsEndpoints module in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs with POST /api/v1/items
- [x] T019 [US1] Register ItemsEndpoints and DI services in src/Recall.Core.Api/Program.cs

### Tests for User Story 1

- [x] T020 [US1] Create ItemsEndpointTests.CreateItem_* tests in src/tests/Recall.Core.Api.Tests/ItemsEndpointTests.cs (201 new, 200 duplicate, 400 invalid URL)

**Checkpoint**: User Story 1 complete - can save URLs with deduplication

---

## Phase 4: User Story 2 - Browse and Filter Saved Items (Priority: P1)

**Goal**: Enable users to list items with pagination and filters (status, collection, tag, favorite)

**Independent Test**: GET /api/v1/items returns paginated items; filters correctly narrow results

### DTOs for User Story 2

- [x] T021 [P] [US2] Create ItemListResponse DTO in src/Recall.Core.Api/Models/ItemListResponse.cs with cursor pagination

### Repository Layer for User Story 2

- [x] T022 [US2] Add ListAsync method to IItemRepository and ItemRepository in src/Recall.Core.Api/Repositories/ with filter and cursor support

### Service Layer for User Story 2

- [x] T023 [US2] Add ListItemsAsync method to IItemService and ItemService in src/Recall.Core.Api/Services/ with filter handling

### Endpoint for User Story 2

- [x] T024 [US2] Add GET /api/v1/items endpoint to src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs with query parameters

### Tests for User Story 2

- [x] T025 [US2] Add ItemsEndpointTests.ListItems_* tests in src/tests/Recall.Core.Api.Tests/ItemsEndpointTests.cs (pagination, filters)

**Checkpoint**: User Stories 1 AND 2 complete - can save and browse items

---

## Phase 5: User Story 3 - Organize Items with Tags (Priority: P2)

**Goal**: Enable users to list, rename, and delete tags globally across all items

**Independent Test**: GET /api/v1/tags returns all tags with counts; PATCH/DELETE modify items globally

### DTOs for User Story 3

- [x] T026 [P] [US3] Create TagDto and TagListResponse in src/Recall.Core.Api/Models/TagDto.cs
- [x] T027 [P] [US3] Create RenameTagRequest and TagOperationResponse in src/Recall.Core.Api/Models/TagOperationModels.cs

### Repository Layer for User Story 3

- [x] T028 [US3] Add tag aggregation methods to IItemRepository and ItemRepository: GetAllTagsWithCountsAsync, RenameTagAsync (returns itemsUpdated count), DeleteTagAsync (returns itemsUpdated count per OpenAPI 200 response)

### Endpoint for User Story 3

- [x] T029 [US3] Create TagsEndpoints module in src/Recall.Core.Api/Endpoints/TagsEndpoints.cs with GET, PATCH /{name}, DELETE /{name}
- [x] T030 [US3] Register TagsEndpoints in src/Recall.Core.Api/Program.cs

### Tests for User Story 3

- [x] T031 [US3] Create TagsEndpointTests in src/tests/Recall.Core.Api.Tests/TagsEndpointTests.cs (list, rename, delete)

**Checkpoint**: User Story 3 complete - can manage tags globally

---

## Phase 6: User Story 4 - Organize Items with Collections (Priority: P2)

**Goal**: Enable users to create, list, update, and delete collections (with default/cascade modes)

**Independent Test**: CRUD operations on /api/v1/collections work correctly; delete modes handle items appropriately

### DTOs for User Story 4

- [ ] T032 [P] [US4] Create CollectionDto in src/Recall.Core.Api/Models/CollectionDto.cs
- [ ] T033 [P] [US4] Create CreateCollectionRequest and UpdateCollectionRequest in src/Recall.Core.Api/Models/CollectionRequestModels.cs
- [ ] T034 [P] [US4] Create CollectionListResponse in src/Recall.Core.Api/Models/CollectionListResponse.cs

### Repository Layer for User Story 4

- [ ] T035 [P] [US4] Create ICollectionRepository interface in src/Recall.Core.Api/Repositories/ICollectionRepository.cs
- [ ] T036 [US4] Implement CollectionRepository in src/Recall.Core.Api/Repositories/CollectionRepository.cs with CRUD operations

### Service Layer for User Story 4

- [ ] T037 [P] [US4] Create ICollectionService interface in src/Recall.Core.Api/Services/ICollectionService.cs
- [ ] T038 [US4] Implement CollectionService in src/Recall.Core.Api/Services/CollectionService.cs with delete modes (default/cascade)

### Endpoint for User Story 4

- [ ] T039 [US4] Create CollectionsEndpoints module in src/Recall.Core.Api/Endpoints/CollectionsEndpoints.cs with full CRUD
- [ ] T039b [US4] Add GET /api/v1/collections/{id} endpoint to src/Recall.Core.Api/Endpoints/CollectionsEndpoints.cs (returns Collection with itemCount)
- [ ] T040 [US4] Register CollectionsEndpoints and DI services in src/Recall.Core.Api/Program.cs

### Tests for User Story 4

- [ ] T041 [US4] Create CollectionsEndpointTests in src/tests/Recall.Core.Api.Tests/CollectionsEndpointTests.cs (CRUD, delete modes, 409 conflict)

**Checkpoint**: User Story 4 complete - can manage collections

---

## Phase 7: User Story 5 - Update Item Metadata (Priority: P2)

**Goal**: Enable users to update item fields (status, favorite, collection, title, excerpt, tags) via PATCH

**Independent Test**: PATCH /api/v1/items/{id} with various fields updates correctly; validates collectionId exists

### DTOs for User Story 5

- [ ] T042 [US5] Create UpdateItemRequest DTO in src/Recall.Core.Api/Models/UpdateItemRequest.cs

### Repository Layer for User Story 5

- [ ] T043 [US5] Add UpdateAsync method to IItemRepository and ItemRepository in src/Recall.Core.Api/Repositories/

### Service Layer for User Story 5

- [ ] T044 [US5] Add UpdateItemAsync method to IItemService and ItemService with collectionId validation

### Endpoint for User Story 5

- [ ] T045 [US5] Add PATCH /api/v1/items/{id} endpoint to src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs

### Tests for User Story 5

- [ ] T046 [US5] Add ItemsEndpointTests.UpdateItem_* tests in src/tests/Recall.Core.Api.Tests/ItemsEndpointTests.cs

**Checkpoint**: User Story 5 complete - can update item metadata

---

## Phase 8: User Story 6 - Delete an Item (Priority: P3)

**Goal**: Enable users to permanently delete a saved item

**Independent Test**: DELETE /api/v1/items/{id} returns 204; subsequent GET returns 404

### Repository Layer for User Story 6

- [ ] T047 [US6] Add DeleteAsync method to IItemRepository and ItemRepository in src/Recall.Core.Api/Repositories/

### Service Layer for User Story 6

- [ ] T048 [US6] Add DeleteItemAsync method to IItemService and ItemService

### Endpoint for User Story 6

- [ ] T049 [US6] Add DELETE /api/v1/items/{id} endpoint to src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs

### Tests for User Story 6

- [ ] T050 [US6] Add ItemsEndpointTests.DeleteItem_* tests in src/tests/Recall.Core.Api.Tests/ItemsEndpointTests.cs (204, 404)

**Checkpoint**: User Story 6 complete - can delete items

---

## Phase 9: User Story 7 - Get Single Item Details (Priority: P3)

**Goal**: Enable users to retrieve full details of a specific item by ID

**Independent Test**: GET /api/v1/items/{id} returns item details; non-existent ID returns 404

### Repository Layer for User Story 7

- [ ] T051 [US7] Add GetByIdAsync method to IItemRepository and ItemRepository in src/Recall.Core.Api/Repositories/

### Service Layer for User Story 7

- [ ] T052 [US7] Add GetItemByIdAsync method to IItemService and ItemService

### Endpoint for User Story 7

- [ ] T053 [US7] Add GET /api/v1/items/{id} endpoint to src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs

### Tests for User Story 7

- [ ] T054 [US7] Add ItemsEndpointTests.GetItem_* tests in src/tests/Recall.Core.Api.Tests/ItemsEndpointTests.cs (200, 404)

**Checkpoint**: All user stories complete

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T055 [P] Run all tests to verify end-to-end functionality
- [ ] T056 [P] Validate quickstart.md scenarios work against running API
- [ ] T057 Verify OpenAPI documentation at /swagger matches contracts/openapi.yaml

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - US1 + US2 are both P1 priority - implement first
  - US3 + US4 + US5 are P2 priority - implement second
  - US6 + US7 are P3 priority - implement last
- **Polish (Phase 10)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Uses Item entity from US1 implementation
- **User Story 3 (P2)**: Can start after Foundational - Uses ItemRepository from US1/US2
- **User Story 4 (P2)**: Can start after Foundational - Independent of items
- **User Story 5 (P2)**: Requires US4 (for collectionId validation) - Most items infrastructure from US1/US2
- **User Story 6 (P3)**: Requires US1 (for items to delete)
- **User Story 7 (P3)**: Requires US1 (for items to get)

### Within Each User Story

- DTOs before repositories/services
- Repositories before services
- Services before endpoints
- Endpoints before tests (tests verify the endpoint)

### Parallel Opportunities

**Phase 2 (Foundational)**: T005, T006, T007, T008 can run in parallel (different files)

**Phase 3 (US1)**: T012, T013, T014, T016 can run in parallel

**Phase 5 (US3)**: T026, T027 can run in parallel

**Phase 6 (US4)**: T032, T033, T034, T035, T037 can run in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# All these can run simultaneously:
Task T005: Create error response DTOs in src/Recall.Core.Api/Models/ErrorResponse.cs
Task T006: Create Item entity in src/Recall.Core.Api/Entities/Item.cs
Task T007: Create Collection entity in src/Recall.Core.Api/Entities/Collection.cs
Task T008: Create pagination models in src/Recall.Core.Api/Models/Pagination.cs
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T011)
3. Complete Phase 3: User Story 1 - Save URLs (T012-T020)
4. Complete Phase 4: User Story 2 - List Items (T021-T025)
5. **STOP and VALIDATE**: Can save and browse items
6. Deploy/demo if ready

### Incremental Delivery

1. MVP: Setup + Foundational + US1 + US2 → Core save/browse functionality
2. Add US3 + US4 → Organization with tags and collections
3. Add US5 → Item metadata updates
4. Add US6 + US7 → Delete and get single item
5. Polish → Documentation and final validation

---

## Notes

- [P] tasks = different files, no dependencies within same phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Use `dotnet test` after each phase to verify no regressions
