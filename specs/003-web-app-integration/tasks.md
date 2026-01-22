````markdown
# Tasks: Web App Integration

**Input**: Design documents from `/specs/003-web-app-integration/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Not explicitly requested - test tasks excluded (add Playwright e2e smoke test in Polish phase per constitution)

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US8)
- All paths relative to `/src/web/`

---

## Phase 1: Setup (Project Configuration)

**Purpose**: Configure web app infrastructure and migrate /design components

- [X] T001 Add Zustand, immer, sonner dependencies to src/web/package.json
- [X] T002 [P] Copy shadcn/ui primitives from /design/src/app/components/ui/ to src/web/src/components/ui/
- [X] T003 [P] Merge styles from /design/src/styles/ into src/web/src/styles/
- [X] T004 [P] Configure Vite proxy for /api routes in src/web/vite.config.ts
- [X] T005 [P] Create lib/utils.ts with cn() helper and extractDomain utility
- [X] T006 [P] Create lib/constants.ts with API base URL and pagination defaults

---

## Phase 2: Foundational (Core Infrastructure)

**Purpose**: API client, type system, stores, and routing that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### API Client Layer

- [X] T007 Create API request/response types in src/web/src/lib/api/types.ts (ItemDto, CollectionDto, TagDto, requests, responses)
- [X] T008 Create base fetch wrapper with error handling in src/web/src/lib/api/client.ts
- [X] T009 [P] Create items API module in src/web/src/lib/api/items.ts
- [X] T010 [P] Create collections API module in src/web/src/lib/api/collections.ts
- [X] T011 [P] Create tags API module in src/web/src/lib/api/tags.ts

### Type System

- [X] T012 [P] Create frontend entity types (Item, Collection, Tag) in src/web/src/types/entities.ts
- [X] T013 [P] Create view state types (ViewState, FilterParams) in src/web/src/types/views.ts

### Global Stores

- [X] T014 Create UI store (viewState, sidebar, modals) in src/web/src/stores/ui-store.ts
- [X] T015 [P] Create toast store with sonner integration in src/web/src/stores/toast-store.ts

### Feature Stores (Empty Shells)

- [X] T016 [P] Create items store shell with state types in src/web/src/features/items/store.ts
- [X] T017 [P] Create collections store shell in src/web/src/features/collections/store.ts
- [X] T018 [P] Create tags store shell in src/web/src/features/tags/store.ts

### Routing & Layout

- [X] T019 Create React Router configuration in src/web/src/routes.tsx
- [X] T020 Create root App component with providers in src/web/src/App.tsx
- [X] T021 Update main.tsx entry point with router setup
- [X] T022 [P] Create Layout shell component in src/web/src/components/layout/Layout.tsx
- [X] T023 [P] Create Sidebar component shell in src/web/src/components/layout/Sidebar.tsx
- [X] T024 [P] Create common LoadingState component in src/web/src/components/common/LoadingState.tsx
- [X] T025 [P] Create common ErrorState component in src/web/src/components/common/ErrorState.tsx
- [X] T026 [P] Create common EmptyState component in src/web/src/components/common/EmptyState.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Save a URL for Later (Priority: P1) 🎯 MVP

**Goal**: Users can save URLs via the web app with validation, deduplication, and feedback

**Independent Test**: Open app → click "Save URL" → enter valid URL → verify item appears in list with success toast

### Implementation for User Story 1

- [ ] T027 [US1] Implement createItem action in items store with API call in src/web/src/features/items/store.ts
- [ ] T028 [P] [US1] Create SaveUrlForm component with URL validation in src/web/src/features/items/components/SaveUrlForm.tsx
- [ ] T029 [US1] Create SaveUrlDialog modal component in src/web/src/features/items/components/SaveUrlDialog.tsx
- [ ] T030 [US1] Wire SaveUrlDialog to UI store modal state and items store createItem
- [ ] T031 [US1] Add duplicate URL detection handling (200 response → "duplicate" toast) in SaveUrlForm
- [ ] T032 [US1] Add inline validation errors for invalid URL input in SaveUrlForm

**Checkpoint**: User Story 1 complete - users can save URLs with full feedback

---

## Phase 4: User Story 2 - Browse and Filter Saved Items (Priority: P1) 🎯 MVP

**Goal**: Users can view items filtered by inbox/favorites/archive/collection/tag with loading states and pagination

**Independent Test**: Open app → items load from API → click sidebar filters → verify correct filtering

### Implementation for User Story 2

- [ ] T033 [US2] Implement fetchItems action with filter params in items store src/web/src/features/items/store.ts
- [ ] T034 [US2] Implement fetchMore (pagination) action in items store
- [ ] T035 [P] [US2] Create ItemList component with loading skeleton in src/web/src/features/items/components/ItemList.tsx
- [ ] T036 [P] [US2] Create ItemRow component for list display in src/web/src/features/items/components/ItemRow.tsx
- [ ] T037 [US2] Create ItemsView container component in src/web/src/features/items/components/ItemsView.tsx
- [ ] T038 [US2] Implement Sidebar navigation with view state updates in src/web/src/components/layout/Sidebar.tsx
- [ ] T039 [US2] Wire viewState changes to items store fetchItems with correct filters
- [ ] T040 [US2] Add "Load more" button with fetchMore integration in ItemList
- [ ] T041 [US2] Add EmptyState display when no items match filter in ItemsView

**Checkpoint**: User Story 2 complete - users can browse and filter items

---

## Phase 5: User Story 3 - View Item Details (Priority: P1) 🎯 MVP

**Goal**: Users can click an item to see full details in a slide-out panel

**Independent Test**: Click item in list → detail panel slides in with title, URL, tags, collection, dates

### Implementation for User Story 3

- [ ] T042 [US3] Add selectItem action and selectedItemId state to items store
- [ ] T043 [US3] Create ItemDetail panel component in src/web/src/features/items/components/ItemDetail.tsx
- [ ] T044 [US3] Wire ItemRow click to selectItem action
- [ ] T045 [US3] Add external link button to open URL in new tab in ItemDetail
- [ ] T046 [US3] Add close button and click-outside handling for ItemDetail panel
- [ ] T047 [US3] Add slide-in animation for ItemDetail panel using motion

**Checkpoint**: User Story 3 complete - users can view item details

---

## Phase 6: User Story 4 - Quick Actions: Favorite and Archive (Priority: P2)

**Goal**: Users can quickly favorite/archive items with optimistic updates and rollback

**Independent Test**: Hover item → click star → verify instant UI update → verify API call → test rollback on error

### Implementation for User Story 4

- [ ] T048 [US4] Implement toggleFavorite with optimistic update in items store src/web/src/features/items/store.ts
- [ ] T049 [US4] Implement toggleArchive with optimistic update in items store
- [ ] T050 [P] [US4] Add favorite (star) icon button to ItemRow with toggle behavior in src/web/src/features/items/components/ItemRow.tsx
- [ ] T051 [P] [US4] Add archive icon button to ItemRow with toggle behavior
- [ ] T052 [US4] Add rollback logic and error toast on API failure for both actions
- [ ] T053 [US4] Add animate-out effect when item is archived from current view

**Checkpoint**: User Story 4 complete - users can quickly organize items

---

## Phase 7: User Story 5 - Delete an Item (Priority: P2)

**Goal**: Users can permanently delete items with confirmation dialog

**Independent Test**: Open item detail → click delete → confirm dialog → verify item removed from list

### Implementation for User Story 5

- [ ] T054 [US5] Implement deleteItem action in items store src/web/src/features/items/store.ts
- [ ] T055 [US5] Create ConfirmDeleteDialog component in src/web/src/features/items/components/ConfirmDeleteDialog.tsx
- [ ] T056 [US5] Add delete button to ItemDetail that opens confirmation dialog
- [ ] T057 [US5] Wire confirmation to deleteItem action with success toast and panel close

**Checkpoint**: User Story 5 complete - users can delete items

---

## Phase 8: User Story 6 - Edit Item Metadata (Priority: P2)

**Goal**: Users can edit item title, collection, and tags from detail panel

**Independent Test**: Open item detail → change collection dropdown → verify PATCH call → verify UI update

### Implementation for User Story 6

- [ ] T058 [US6] Implement updateItem action in items store src/web/src/features/items/store.ts
- [ ] T059 [US6] Add collection dropdown selector to ItemDetail in src/web/src/features/items/components/ItemDetail.tsx
- [ ] T060 [US6] Add tag editor with add/remove capability to ItemDetail
- [ ] T061 [P] [US6] Create TagChip component for tag display in src/web/src/features/tags/components/TagChip.tsx
- [ ] T062 [US6] Wire collection/tag changes to updateItem action with feedback

**Checkpoint**: User Story 6 complete - users can edit item metadata

---

## Phase 9: User Story 7 - View and Navigate Collections (Priority: P2)

**Goal**: Users can see collections in sidebar with counts and create new collections

**Independent Test**: Load app → verify collections appear in sidebar → click collection → items filter → create new collection

### Implementation for User Story 7

- [ ] T063 [US7] Implement fetchCollections action in collections store src/web/src/features/collections/store.ts
- [ ] T064 [US7] Implement createCollection action in collections store
- [ ] T065 [P] [US7] Create CollectionList component for sidebar in src/web/src/features/collections/components/CollectionList.tsx
- [ ] T066 [P] [US7] Create CreateCollectionDialog component in src/web/src/features/collections/components/CreateCollectionDialog.tsx
- [ ] T067 [US7] Wire CollectionList to Sidebar with navigation on click
- [ ] T068 [US7] Wire CreateCollectionDialog to UI store modal state and collections store

**Checkpoint**: User Story 7 complete - users can manage collections

---

## Phase 10: User Story 8 - View and Navigate Tags (Priority: P2)

**Goal**: Users can see all tags in sidebar with counts and filter items by tag

**Independent Test**: Load app → verify tags appear in sidebar → click tag → items filter to that tag

### Implementation for User Story 8

- [ ] T069 [US8] Implement fetchTags action in tags store src/web/src/features/tags/store.ts
- [ ] T070 [US8] Create TagList component for sidebar in src/web/src/features/tags/components/TagList.tsx
- [ ] T071 [US8] Wire TagList to Sidebar with navigation on click
- [ ] T072 [US8] Add tag color assignment based on name hash in TagList

**Checkpoint**: User Story 8 complete - users can navigate by tags

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, final integration, and smoke testing

- [ ] T073 [P] Add keyboard navigation support to ItemList (arrow keys, enter to select)
- [ ] T074 [P] Add keyboard navigation to Sidebar (tab, arrow keys)
- [ ] T075 [P] Add focus management for dialogs (trap focus, return focus on close)
- [ ] T076 [P] Add ARIA labels to all icon-only buttons in ItemRow and ItemDetail
- [ ] T077 Add error boundary component for graceful error handling in src/web/src/components/common/ErrorBoundary.tsx
- [ ] T078 Create Playwright e2e smoke test (create→list→detail→delete) in src/web/e2e/smoke.spec.ts
- [ ] T079 Run quickstart.md validation (full stack test with Aspire)
- [ ] T080 Verify bundle size < 200KB gzip target

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phases 3-10)**: All depend on Foundational completion
  - P1 stories (US1-3) are MVP-critical
  - P2 stories (US4-8) can proceed after Foundational
- **Polish (Phase 11)**: Depends on desired user stories being complete

### User Story Dependencies

| Story | Priority | Dependencies | Notes |
|-------|----------|--------------|-------|
| US1: Save URL | P1 | Foundational | Core MVP functionality |
| US2: Browse/Filter | P1 | Foundational | Core MVP functionality |
| US3: View Details | P1 | Foundational, benefits from US2 ItemRow | Core MVP functionality |
| US4: Quick Actions | P2 | US2 (ItemRow exists) | Enhances browsing experience |
| US5: Delete Item | P2 | US3 (ItemDetail exists) | Extends detail panel |
| US6: Edit Metadata | P2 | US3 (ItemDetail exists), US7 (collections), US8 (tags) | Full editing requires collections/tags loaded |
| US7: Collections | P2 | Foundational | Can start after Foundational |
| US8: Tags | P2 | Foundational | Can start after Foundational |

### Parallel Opportunities per Phase

**Phase 1 (Setup)**: T002, T003, T004, T005, T006 all parallel

**Phase 2 (Foundational)**:
- T009, T010, T011 parallel (API modules)
- T012, T013 parallel (types)
- T016, T017, T018 parallel (store shells)
- T022, T023, T024, T025, T026 parallel (components)

**User Stories**: US7 and US8 can run in parallel with US4-6

---

## Parallel Example: Foundational Phase

```bash
# After T007, T008 complete, launch API modules together:
Task: "Create items API module in src/web/src/lib/api/items.ts"
Task: "Create collections API module in src/web/src/lib/api/collections.ts"
Task: "Create tags API module in src/web/src/lib/api/tags.ts"

# Launch types together:
Task: "Create frontend entity types in src/web/src/types/entities.ts"
Task: "Create view state types in src/web/src/types/views.ts"

# Launch store shells together:
Task: "Create items store shell in src/web/src/features/items/store.ts"
Task: "Create collections store shell in src/web/src/features/collections/store.ts"
Task: "Create tags store shell in src/web/src/features/tags/store.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 - Save URL ✅
4. Complete Phase 4: US2 - Browse/Filter ✅
5. Complete Phase 5: US3 - View Details ✅
6. **STOP and VALIDATE**: Test all P1 stories - this is a deployable MVP
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1-3 → **MVP Complete** (save, browse, view)
3. Add US4 → Quick actions enhance browsing
4. Add US5-6 → Full item management
5. Add US7-8 → Full organization features
6. Polish → Accessibility, testing, optimization

### Parallel Team Strategy

With multiple developers after Foundational:

- **Developer A**: US1 (Save) → US4 (Quick Actions) → US5 (Delete)
- **Developer B**: US2 (Browse) → US3 (Details) → US6 (Edit)
- **Developer C**: US7 (Collections) → US8 (Tags) → Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All paths relative to `/src/web/` unless otherwise specified
- shadcn/ui components copied from /design provide accessible primitives
- API client uses Vite proxy - no CORS configuration needed in dev
- Zustand stores enable optimistic updates with simple rollback pattern
- Commit after each task or logical group
- Run `pnpm typecheck` after type changes
- Run `pnpm dev` to validate changes in browser

````
