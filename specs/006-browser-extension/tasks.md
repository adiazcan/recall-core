# Tasks: Chrome/Edge Browser Extension

**Input**: Design documents from `/specs/006-browser-extension/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Manual testing only (no official automation support for extension-specific APIs per plan.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, build tooling, and basic structure

- [X] T001 Create extension project structure at src/extension/ per plan.md
- [X] T002 Initialize package.json with React 19, Vite 6, CRXJS plugin, and TypeScript dependencies in src/extension/package.json
- [X] T003 [P] Configure TypeScript with ES2022 target in src/extension/tsconfig.json
- [X] T004 [P] Configure Vite with CRXJS plugin for MV3 in src/extension/vite.config.ts
- [X] T005 [P] Create manifest.json with MV3 structure (permissions, service_worker, side_panel, commands) in src/extension/manifest.json
- [X] T006 [P] Create environment configuration files (.env.development, .env.production) in src/extension/
- [X] T007 [P] Create placeholder icon assets (16, 32, 48, 128px) in src/extension/assets/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services and types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Types and Configuration

- [X] T008 Create shared TypeScript types from contracts/messages.ts in src/extension/src/types/index.ts
- [X] T009 [P] Implement environment-aware configuration module in src/extension/src/config/index.ts

### Core Services

- [X] T010 Implement chrome.storage wrapper service in src/extension/src/services/storage.ts
- [X] T011 Implement authentication service with PKCE flow (launchWebAuthFlow, token exchange, silent token refresh with expiry check, re-auth prompt on refresh failure) in src/extension/src/services/auth.ts
- [X] T012 [P] Implement chrome.runtime message helpers in src/extension/src/services/messaging.ts
- [X] T013 Implement API client service with Bearer token attachment in src/extension/src/services/api.ts

### Service Worker Foundation

- [X] T014 Create service worker skeleton with message listener registration in src/extension/src/background/service-worker.ts
- [X] T015 Implement auth message handlers (GET_AUTH_STATE, SIGN_IN, SIGN_OUT, REFRESH_TOKEN) in service worker src/extension/src/background/service-worker.ts

### Entry Points

- [X] T016 [P] Create popup HTML entry point in src/extension/src/popup/index.html
- [X] T017 [P] Create side panel HTML entry point in src/extension/src/sidepanel/index.html

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Save Current Tab Quickly (Priority: P1) 🎯 MVP

**Goal**: Users can save the current page URL to Recall inbox with one click

**Independent Test**: Click extension icon → Click "Save current tab" → Verify success message and item appears in Recall API/web app

### Service Worker Implementation for US1

- [X] T018 [US1] Implement SAVE_URL message handler in service worker (call POST /api/v1/items) in src/extension/src/background/service-worker.ts
- [X] T019 [US1] Add URL validation and restricted URL checking (chrome://, edge://, about:) in src/extension/src/services/api.ts
- [X] T020 [US1] Implement command handler for quick save keyboard shortcut (save-current-tab command) in src/extension/src/background/service-worker.ts

### Popup UI for US1

- [X] T021 [US1] Create popup React mount and entry in src/extension/src/popup/main.tsx
- [X] T022 [US1] Create AuthStatus component showing sign-in state in src/extension/src/popup/components/AuthStatus.tsx
- [X] T023 [US1] Create SaveCurrentTab component with save button and feedback in src/extension/src/popup/components/SaveCurrentTab.tsx
- [X] T024 [US1] Create SaveProgress component for loading/success/error states in src/extension/src/popup/components/SaveProgress.tsx
- [X] T025 [US1] Create main Popup component with auth check and save current tab view in src/extension/src/popup/Popup.tsx

### Error Handling for US1

- [X] T026 [US1] Handle API response codes (201 created, 200 dedupe, 4xx/5xx errors) with user-friendly messages in src/extension/src/popup/components/SaveCurrentTab.tsx
- [X] T027 [US1] Handle unauthenticated state with sign-in prompt in src/extension/src/popup/Popup.tsx

**Checkpoint**: User Story 1 complete - can save current tab with one click, see success/error feedback

---

## Review Follow-ups (AI)

**Generated:** 2026-01-26 | **Reviewer:** Code Review Agent

### Critical

- [X] [AI-Review][CRITICAL] Commit extension directory to git - all Phase 1-3 code is untracked [src/extension/]
- [X] [AI-Review][CRITICAL] Fix TypeScript error: Add JSX import to sidepanel/main.tsx [src/extension/src/sidepanel/main.tsx#L12]

### High

- [X] [AI-Review][HIGH] Fix deduplication detection - always returns isNew:true instead of checking 200 vs 201 response [src/extension/src/services/api.ts#L149]
- [X] [AI-Review][HIGH] Create vitest.config.ts and tests/setup.ts for test infrastructure [src/extension/]
- [ ] [AI-Review][HIGH] Create eslint.config.js - lint script defined but config missing [src/extension/]

### Medium

- [ ] [AI-Review][MEDIUM] Add cleanup to useEffect to prevent state updates after unmount [src/extension/src/popup/components/SaveCurrentTab.tsx#L28-L55]
- [ ] [AI-Review][MEDIUM] Create properly sized icon assets (16/32/48/128px) - currently all identical [src/extension/src/assets/]
- [ ] [AI-Review][MEDIUM] Consider migrating inline styles to Tailwind CSS for consistency with web app [src/extension/src/popup/]
- [ ] [AI-Review][MEDIUM] Handle background token refresh failure by prompting re-auth in UI [src/extension/src/services/auth.ts#L183-L186]

### Low

- [ ] [AI-Review][LOW] Remove unused _view/_setView state variables or mark as intentional [src/extension/src/popup/Popup.tsx#L18]
- [ ] [AI-Review][LOW] Replace console.log with conditional logging for production [src/extension/src/background/service-worker.ts]
- [ ] [AI-Review][LOW] Add empty string guard to getInitials function [src/extension/src/popup/components/AuthStatus.tsx#L71]

---

## Phase 4: User Story 2 - Side Panel with Recall Web App (Priority: P2)

**Goal**: Users can open side panel to browse saved items without leaving current tab

**Independent Test**: Click "Open Side Panel" → Side panel opens with Recall web app → Navigate Inbox/Collections/Tags → Verify SSO (no additional sign-in required)

### Service Worker Implementation for US2

- [ ] T028 [US2] Implement OPEN_SIDE_PANEL message handler using chrome.sidePanel.open() in src/extension/src/background/service-worker.ts

### Side Panel UI for US2

- [ ] T029 [US2] Create side panel React mount with token receiver listener in src/extension/src/sidepanel/main.tsx
- [ ] T030 [US2] Create SidePanel component that embeds web app URL in responsive iframe in src/extension/src/sidepanel/SidePanel.tsx
- [ ] T031 [US2] Implement postMessage token sharing from extension to web app (RECALL_EXT_AUTH) in src/extension/src/sidepanel/SidePanel.tsx
- [ ] T032 [US2] Handle RECALL_REQUEST_TOKEN message from web app and respond with token in src/extension/src/sidepanel/SidePanel.tsx

### Popup Integration for US2

- [ ] T033 [US2] Add "Open Side Panel" button to Popup component in src/extension/src/popup/Popup.tsx

### Error States for US2

- [ ] T034 [US2] Handle web app load failure with retry option and "open in new tab" link in src/extension/src/sidepanel/SidePanel.tsx
- [ ] T035 [US2] Handle unauthenticated state in side panel with sign-in guidance in src/extension/src/sidepanel/SidePanel.tsx

**Checkpoint**: User Story 2 complete - can open side panel, browse Recall content, SSO works

---

## Phase 5: User Story 3 - Save Multiple Selected Tabs (Priority: P3)

**Goal**: Users can batch-save multiple tabs at once with progress feedback

**Independent Test**: Open multiple tabs → Click extension → Select "Save selected tabs" → Check tabs → Save → Verify summary shows created/deduplicated/failed counts

### Service Worker Implementation for US3

- [ ] T036 [US3] Implement SAVE_URLS message handler with limited concurrency (2-3 parallel requests) in src/extension/src/background/service-worker.ts
- [ ] T037 [US3] Implement progress reporting for batch operations in src/extension/src/background/service-worker.ts

### Popup UI for US3

- [ ] T038 [US3] Create TabList component with checkbox selection for open tabs in src/extension/src/popup/components/TabList.tsx
- [ ] T039 [US3] Create SaveSelectedTabs component orchestrating batch selection and save in src/extension/src/popup/components/SaveSelectedTabs.tsx
- [ ] T040 [US3] Add batch progress indicator with current/total count in src/extension/src/popup/components/SaveProgress.tsx
- [ ] T041 [US3] Add batch result summary (X saved, Y already existed, Z failed) in src/extension/src/popup/components/SaveSelectedTabs.tsx

### Popup Navigation for US3

- [ ] T042 [US3] Update Popup component with view switching between main and batch-select views in src/extension/src/popup/Popup.tsx
- [ ] T043 [US3] Add "Save selected tabs" button to main popup view in src/extension/src/popup/Popup.tsx

### Edge Cases for US3

- [ ] T044 [US3] Filter and mark restricted URLs (chrome://, edge://, about:) as non-selectable in TabList in src/extension/src/popup/components/TabList.tsx
- [ ] T045 [US3] Handle cancel action to return to main popup without saving in src/extension/src/popup/components/SaveSelectedTabs.tsx

**Checkpoint**: User Story 3 complete - can batch-select tabs, save with progress, see summary

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, configuration, and production readiness

- [ ] T046 [P] Create extension development setup documentation in docs/extension/setup.md
- [ ] T047 [P] Create Entra app registration guide for extension in docs/extension/entra-configuration.md
- [ ] T048 [P] Create manual testing checklist in docs/extension/testing-checklist.md
- [ ] T049 Generate stable extension key for consistent ID and update manifest.json
- [ ] T050 [P] Create unit tests for storage service in src/extension/tests/services/storage.test.ts
- [ ] T051 [P] Create unit tests for auth service (mocking chrome.identity) in src/extension/tests/services/auth.test.ts
- [ ] T052 [P] Create unit tests for API service in src/extension/tests/services/api.test.ts
- [ ] T053 Configure Vitest for extension tests in src/extension/vitest.config.ts and src/extension/tests/setup.ts
- [ ] T054 Run quickstart.md validation to verify end-to-end flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel if staffed
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on at least User Story 1 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Reuses SaveProgress component from US1

### Within Each User Story

- Service worker handlers before UI components
- Core components before integration components
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003-T007)
- Foundational types and config tasks marked [P] can run in parallel (T008-T009)
- Foundational entry points marked [P] can run in parallel (T016-T017)
- Once Foundational phase completes, all user stories can start in parallel
- All Polish tasks marked [P] can run in parallel (T046-T052)

---

## Parallel Example: Setup Phase

```bash
# Launch in parallel after T001, T002 complete:
Task T003: "Configure TypeScript in src/extension/tsconfig.json"
Task T004: "Configure Vite with CRXJS in src/extension/vite.config.ts"
Task T005: "Create manifest.json in src/extension/manifest.json"
Task T006: "Create environment files in src/extension/"
Task T007: "Create placeholder icons in src/extension/assets/"
```

## Parallel Example: User Story 1

```bash
# After T018-T020 (service worker) complete, launch popup components in parallel:
Task T022: "Create AuthStatus component"
Task T023: "Create SaveCurrentTab component"
Task T024: "Create SaveProgress component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Load extension, test save current tab
5. Deploy/demo if ready - delivers core value proposition

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test save current tab → Demo (MVP!)
3. Add User Story 2 → Test side panel + SSO → Demo
4. Add User Story 3 → Test batch save → Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (save current tab)
   - Developer B: User Story 2 (side panel)
   - Developer C: User Story 3 (batch save - may wait for US1 SaveProgress)
3. Stories complete and integrate via shared service worker

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [US1/US2/US3] label maps task to specific user story
- Each user story is independently completable and testable
- Extension testing is primarily manual due to chrome.* API limitations
- Unit tests cover service logic with chrome API mocks
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
