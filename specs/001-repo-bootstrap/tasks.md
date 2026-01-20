````markdown
# Tasks: Repository Bootstrap

**Input**: Design documents from `/specs/001-repo-bootstrap/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Include backend and frontend test tasks as specified in FR-007 and FR-017.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, solution structure, and basic configuration

- [X] T001 Create solution file src/RecallCore.sln in src/
- [X] T002 Create Aspire AppHost project in src/Recall.Core.AppHost/Recall.Core.AppHost.csproj with SDK Aspire.AppHost.Sdk/13.1
- [X] T003 [P] Create ServiceDefaults project in src/Recall.Core.ServiceDefaults/Recall.Core.ServiceDefaults.csproj
- [X] T004 [P] Create API project in src/Recall.Core.Api/Recall.Core.Api.csproj
- [X] T005 [P] Create frontend project structure in src/web/ with package.json, vite.config.ts, tsconfig.json
- [X] T006 [P] Create backend test project in src/tests/Recall.Core.Api.Tests/Recall.Core.Api.Tests.csproj
- [X] T007 [P] Create .editorconfig at repository root for consistent editor settings
- [X] T008 [P] Create .gitignore at repository root for .NET and Node.js
- [X] T009 Add project references to solution file (AppHost, ServiceDefaults, Api, Tests)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Implement ServiceDefaults Extensions.cs with OpenTelemetry configuration in src/Recall.Core.ServiceDefaults/Extensions.cs
- [X] T011 Configure AppHost.cs with MongoDB, API, and frontend resources in src/Recall.Core.AppHost/AppHost.cs
- [X] T012 [P] Create launchSettings.json for AppHost in src/Recall.Core.AppHost/Properties/launchSettings.json
- [X] T013 [P] Create launchSettings.json for API in src/Recall.Core.Api/Properties/launchSettings.json
- [X] T014 [P] Create appsettings.json and appsettings.Development.json for API environment configuration in src/Recall.Core.Api/
- [X] T015 Configure Vite with React and Tailwind CSS 4 in src/web/vite.config.ts
- [X] T016 [P] Create tsconfig.json with strict TypeScript settings in src/web/tsconfig.json
- [X] T017 [P] Create ESLint configuration in src/web/eslint.config.js
- [X] T018 [P] Create Tailwind CSS entry point in src/web/src/index.css

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Developer Runs Full Stack Locally (Priority: P1) 🎯 MVP

**Goal**: Enable developers to clone the repo and run the entire application stack with a single command

**Independent Test**: Clone repo, run `dotnet run --project src/Recall.Core.AppHost`, verify backend API and frontend both start within 60 seconds

### Implementation for User Story 1

- [X] T019 [US1] Implement minimal Program.cs with health endpoint stub in src/Recall.Core.Api/Program.cs
- [X] T020 [US1] Create React entry point main.tsx in src/web/src/main.tsx
- [X] T021 [US1] Create App.tsx with router setup in src/web/src/App.tsx
- [X] T022 [US1] Create RootLayout.tsx page component in src/web/src/pages/RootLayout.tsx
- [X] T023 [US1] Create HomePage.tsx that will display health status in src/web/src/pages/HomePage.tsx
- [X] T024 [US1] Create index.html entry point in src/web/index.html
- [X] T025 [US1] Create README.md with prerequisites and step-by-step run instructions at repository root
- [X] T026 [US1] Create docs/ directory with placeholder documentation in docs/README.md

**Checkpoint**: User Story 1 complete - full stack starts with single command

---

## Phase 4: User Story 2 - Developer Verifies System Health (Priority: P1)

**Goal**: Provide health verification endpoint and UI to confirm the system is operational

**Independent Test**: Call GET /health and receive 200 with `{ "status": "ok" }`, view frontend showing health status

### Tests for User Story 2

- [X] T027 [P] [US2] Create health endpoint integration test in src/tests/Recall.Core.Api.Tests/HealthEndpointTests.cs
- [X] T028 [P] [US2] Create HealthStatus component test in src/web/src/components/HealthStatus.test.tsx

### Implementation for User Story 2

- [X] T029 [US2] Enhance Program.cs with full health endpoint returning `{ "status": "ok" }` in src/Recall.Core.Api/Program.cs
- [X] T030 [US2] Add CORS configuration for frontend origin in src/Recall.Core.Api/Program.cs
- [X] T031 [US2] Create HealthStatus.tsx component that fetches /health in src/web/src/components/HealthStatus.tsx
- [X] T032 [US2] Integrate HealthStatus component into HomePage.tsx in src/web/src/pages/HomePage.tsx
- [X] T033 [US2] Add error handling for backend unavailable state in src/web/src/components/HealthStatus.tsx
- [X] T034 [US2] Configure Vitest for frontend testing in src/web/vitest.config.ts and src/web/package.json

**Checkpoint**: User Story 2 complete - health endpoint works and UI displays status

---

## Phase 5: User Story 3 - Developer Explores API Documentation (Priority: P2)

**Goal**: Provide interactive Swagger/OpenAPI documentation for API exploration

**Independent Test**: Navigate to /swagger in browser when running in development mode, see interactive API documentation

### Implementation for User Story 3

- [X] T035 [US3] Add Swagger/OpenAPI configuration to Program.cs (development only) in src/Recall.Core.Api/Program.cs
- [X] T036 [US3] Add OpenAPI metadata to health endpoint with description and tags in src/Recall.Core.Api/Program.cs
- [X] T037 [US3] Update README.md with Swagger UI access instructions at repository root

**Checkpoint**: User Story 3 complete - Swagger UI accessible in development mode

---

## Phase 6: User Story 4 - CI Pipeline Validates Code Changes (Priority: P2)

**Goal**: Automated builds and tests run on every push to catch errors early

**Independent Test**: Push a commit, observe GitHub Actions workflow execute successfully

### Implementation for User Story 4

- [X] T038 [P] [US4] Create GitHub Actions workflow file in .github/workflows/ci.yml
- [X] T039 [US4] Configure workflow to build backend (.NET restore, build)
- [X] T040 [US4] Configure workflow to build frontend (npm install, npm run build)
- [X] T041 [US4] Configure workflow to run backend tests (dotnet test)
- [X] T042 [US4] Configure workflow to run frontend tests (npm run test)
- [X] T043 [US4] Configure workflow to run linting checks (dotnet format --verify-no-changes, npm run lint)

**Checkpoint**: User Story 4 complete - CI pipeline builds and tests on every push

---

## Phase 7: User Story 5 - Developer Maintains Code Quality (Priority: P3)

**Goal**: Enforce consistent code formatting and linting across the codebase

**Independent Test**: Run `dotnet format --verify-no-changes` and `npm run lint` with zero violations

### Implementation for User Story 5

- [X] T044 [P] [US5] Create .globalconfig or src/Directory.Build.props for .NET analyzer rules in src/
- [X] T045 [P] [US5] Add Prettier configuration in src/web/.prettierrc
- [X] T046 [US5] Add npm scripts for lint and format in src/web/package.json
- [X] T047 [US5] Verify all bootstrap code passes formatting and linting checks

**Checkpoint**: User Story 5 complete - code quality tools configured and passing

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation updates

- [X] T048 [P] Run quickstart.md validation - verify all commands work as documented
- [X] T049 [P] Verify SC-001: New developer can run stack within 10 minutes
- [X] T050 [P] Verify SC-002: Health endpoint responds in under 100ms
- [X] T051 [P] Verify SC-003: Frontend displays health status without console errors
- [X] T052 Verify SC-004: All code passes formatting and linting checks
- [X] T053 Verify SC-005: CI pipeline completes within 5 minutes
- [X] T054 Final README.md review and update at repository root

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 - implement sequentially (US2 depends on US1 basic structure)
  - US3 and US4 are both P2 - can proceed in parallel after US1/US2
  - US5 is P3 - can proceed after foundational
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational - establishes basic project structure
- **User Story 2 (P1)**: After US1 - adds health endpoint functionality to existing structure
- **User Story 3 (P2)**: After US2 - adds Swagger to existing API
- **User Story 4 (P2)**: After Foundational - independent, CI only needs project structure
- **User Story 5 (P3)**: After Foundational - quality tools independent of features

### Within Each User Story

- Tests should be written first and fail before implementation (TDD)
- Infrastructure before features
- Backend before frontend integration
- Story complete before moving to next priority

### Parallel Opportunities

- Setup: T003, T004, T005, T006, T007, T008 can all run in parallel
- Foundational: T012, T013, T014, T016, T017, T018 can run in parallel
- US2 Tests: T027, T028 can run in parallel
- US4: T038 starts the workflow file, subsequent tasks build on it
- US5: T044, T045 can run in parallel
- Polish: T048, T049, T050, T051 can run in parallel

---

## Parallel Example: Setup Phase

```bash
# Launch all parallelizable setup tasks together:
Task: "Create ServiceDefaults project in src/Recall.Core.ServiceDefaults/Recall.Core.ServiceDefaults.csproj"
Task: "Create API project in src/Recall.Core.Api/Recall.Core.Api.csproj"
Task: "Create frontend project structure in src/web/ with package.json, vite.config.ts, tsconfig.json"
Task: "Create backend test project in src/tests/Recall.Core.Api.Tests/Recall.Core.Api.Tests.csproj"
Task: "Create .editorconfig at repository root"
Task: "Create .gitignore at repository root"
```

---

## Parallel Example: User Story 2 Tests

```bash
# Launch all tests for User Story 2 together:
Task: "Create health endpoint integration test in src/tests/Recall.Core.Api.Tests/HealthEndpointTests.cs"
Task: "Create HealthStatus component test in src/web/src/components/HealthStatus.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (full stack runs)
4. Complete Phase 4: User Story 2 (health endpoint works)
5. **STOP and VALIDATE**: Test US1 + US2 independently
6. This delivers a working smoke path - MVP complete!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + 2 → Working health check stack (MVP!)
3. Add User Story 3 → Swagger documentation available
4. Add User Story 4 → CI pipeline protecting code quality
5. Add User Story 5 → Code quality tools enforced
6. Polish phase → Final validation

### Suggested Execution Order

1. T001 → T002 → T009 (solution setup must be sequential)
2. T003, T004, T005, T006, T007, T008 in parallel
3. T010 → T011 (ServiceDefaults before AppHost uses it)
4. T012, T013, T014, T015, T016, T017, T018 in parallel
5. US1: T019 → T020-T026 (mostly parallel-able after T019)
6. US2: T027, T028 (tests first) → T029-T034
7. US3: T035 → T036 → T037
8. US4: T038 → T039-T043 (sequential workflow building)
9. US5: T044, T045 parallel → T046 → T047
10. Polish: T048-T054

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Aspire 13.1 SDK is mandatory - do not use older versions
- MongoDB runs as persistent container via Aspire

````
