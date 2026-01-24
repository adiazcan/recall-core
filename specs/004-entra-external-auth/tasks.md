# Tasks: Microsoft Entra External ID Authentication

**Input**: Design documents from `/specs/004-entra-external-auth/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US7 from spec.md)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `src/Recall.Core.Api/`
- **Frontend**: `src/web/src/`
- **Tests (backend)**: `src/tests/Recall.Core.Api.Tests/`
- **Tests (frontend)**: `src/web/src/__tests__/` or co-located
- **Docs**: `docs/auth/`

---

## Phase 1: Setup

**Purpose**: Install dependencies and create configuration structure (no secrets committed)

- [X] T001 Add Microsoft.Identity.Web package to src/Recall.Core.Api/Recall.Core.Api.csproj
- [X] T002 [P] Add @azure/msal-browser and @azure/msal-react packages to src/web/package.json
- [X] T003 [P] Create AzureAd configuration section structure in src/Recall.Core.Api/appsettings.json (placeholders only)
- [X] T004 [P] Create .env.example with MSAL environment variables in src/web/.env.example
- [X] T005 [P] Add src/web/.env.local to .gitignore if not already present
- [X] T006 Create docs/auth/ directory structure for documentation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core authentication infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend Authentication Middleware

- [X] T007 Configure JWT Bearer authentication with Microsoft.Identity.Web in src/Recall.Core.Api/Program.cs
- [X] T008 Add authorization policy "ApiScope" requiring "access_as_user" scope in src/Recall.Core.Api/Program.cs
- [X] T009 [P] Create test authentication bypass handler for development/CI in src/Recall.Core.Api/Auth/TestAuthHandler.cs
- [X] T010 Configure test bypass conditional registration in src/Recall.Core.Api/Program.cs

### User Context Infrastructure

- [X] T011 [P] Create IUserContext interface in src/Recall.Core.Api/Auth/IUserContext.cs
- [X] T012 [P] Implement HttpUserContext extracting userId from ClaimsPrincipal in src/Recall.Core.Api/Auth/HttpUserContext.cs
- [X] T013 Register IUserContext as scoped service in src/Recall.Core.Api/Program.cs

### Entity Changes (Data Model)

- [X] T014 [P] Add UserId property with BsonElement attribute to Item entity in src/Recall.Core.Api/Entities/Item.cs
- [X] T015 [P] Add UserId property with BsonElement attribute to Collection entity in src/Recall.Core.Api/Entities/Collection.cs

### Response Models

- [X] T016 Create UserInfoResponse record in src/Recall.Core.Api/Models/UserInfoResponse.cs

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 3 + 5 - API Protection & Data Isolation (Priority: P1) 🎯 MVP

**Goal**: All API endpoints require valid JWT with scope; all data is isolated per user via userId

**Independent Test**: Call any /api/v1 endpoint without token → 401; call with valid token → only see own data

### Repository Layer Updates (Data Isolation)

- [X] T017 [US5] Update IItemRepository interface to require userId parameter in src/Recall.Core.Api/Repositories/IItemRepository.cs
- [X] T018 [US5] Update ItemRepository to filter all queries by userId in src/Recall.Core.Api/Repositories/ItemRepository.cs
- [X] T019 [P] [US5] Update ICollectionRepository interface to require userId parameter in src/Recall.Core.Api/Repositories/ICollectionRepository.cs
- [X] T020 [P] [US5] Update CollectionRepository to filter all queries by userId in src/Recall.Core.Api/Repositories/CollectionRepository.cs

### Service Layer Updates (Data Isolation)

- [X] T021 [US5] Update IItemService interface to accept userId from IUserContext in src/Recall.Core.Api/Services/IItemService.cs
- [X] T022 [US5] Update ItemService to inject IUserContext and pass userId to repository in src/Recall.Core.Api/Services/ItemService.cs
- [X] T023 [P] [US5] Update ICollectionService interface to accept userId from IUserContext in src/Recall.Core.Api/Services/ICollectionService.cs
- [X] T024 [P] [US5] Update CollectionService to inject IUserContext and pass userId to repository in src/Recall.Core.Api/Services/CollectionService.cs

**Note**: Tags are embedded in Items (no separate TagService). Tag operations use IItemRepository which is updated in T017-T018.

### Endpoint Authorization (API Protection)

- [X] T027 [US3] Apply RequireAuthorization("ApiScope") to Items endpoint group in src/Recall.Core.Api/Endpoints/ItemsEndpoints.cs
- [X] T028 [P] [US3] Apply RequireAuthorization("ApiScope") to Collections endpoint group in src/Recall.Core.Api/Endpoints/CollectionsEndpoints.cs
- [X] T029 [P] [US3] Apply RequireAuthorization("ApiScope") to Tags endpoint group in src/Recall.Core.Api/Endpoints/TagsEndpoints.cs

### Backend Tests

- [X] T030 [US3] Add integration test for 401 response without token in src/tests/Recall.Core.Api.Tests/Auth/UnauthorizedTests.cs
- [X] T031 [P] [US3] Add integration test for 403 response with token missing scope in src/tests/Recall.Core.Api.Tests/Auth/ForbiddenTests.cs
- [X] T032 [P] [US5] Add integration test for data isolation between users in src/tests/Recall.Core.Api.Tests/Auth/DataIsolationTests.cs

**Checkpoint**: Backend API is now protected and data isolated - US3 and US5 complete

---

## Phase 4: User Story 4 - User Views Their Own Identity (Priority: P2)

**Goal**: Authenticated user can call GET /api/v1/me to get their identity info

**Independent Test**: Sign in, call GET /api/v1/me, verify response contains sub, displayName, email, tenantId

### Implementation

- [ ] T033 [US4] Create MeEndpoints class with GET /api/v1/me endpoint in src/Recall.Core.Api/Endpoints/MeEndpoints.cs
- [ ] T034 [US4] Register MeEndpoints in src/Recall.Core.Api/Program.cs
- [ ] T035 [US4] Add integration test for /me endpoint in src/tests/Recall.Core.Api.Tests/Endpoints/MeEndpointsTests.cs

**Checkpoint**: /me endpoint returns user identity - US4 complete

---

## Phase 5: User Stories 1 + 2 - Sign-up & Sign-in (Priority: P1)

**Goal**: New users can sign up via Microsoft Account; returning users can sign in and see their data

**Independent Test**: Navigate to app → click Sign In → complete Microsoft Account flow → land on protected page with name displayed

### MSAL Configuration

- [ ] T036 [US1] Create authConfig.ts with MSAL configuration in src/web/src/lib/authConfig.ts
- [ ] T037 [US1] Create msalInstance.ts with PublicClientApplication in src/web/src/lib/msalInstance.ts
- [ ] T038 [P] [US1] Create loginRequest and apiRequest scope configurations in src/web/src/lib/authConfig.ts

### MSAL Provider Integration

- [ ] T039 [US1] Wrap App with MsalProvider in src/web/src/main.tsx
- [ ] T040 [US1] Create useAuth custom hook for token acquisition in src/web/src/hooks/useAuth.ts

### Auth Components

- [ ] T041 [US1] Create SignInButton component with loginRedirect in src/web/src/components/auth/SignInButton.tsx
- [ ] T042 [P] [US1] Create AuthGuard component for protected routes in src/web/src/components/auth/AuthGuard.tsx
- [ ] T043 [P] [US2] Create UserDisplay component showing authenticated user info in src/web/src/components/auth/UserDisplay.tsx

### Route Protection

- [ ] T044 [US1] Wrap protected routes with AuthGuard in src/web/src/App.tsx
- [ ] T045 [US2] Update API client to attach Bearer token to all /api/v1 requests in src/web/src/lib/api.ts (or equivalent)

### Frontend Tests

- [ ] T046 [US1] Add unit test for SignInButton component in src/web/src/components/auth/SignInButton.test.tsx
- [ ] T047 [P] [US1] Add unit test for AuthGuard component in src/web/src/components/auth/AuthGuard.test.tsx

**Checkpoint**: Users can sign up and sign in via Microsoft Account - US1 and US2 complete

---

## Phase 6: User Story 6 - Sign Out (Priority: P2)

**Goal**: Authenticated user can sign out and return to unauthenticated state

**Independent Test**: Sign in → click Sign Out → verify redirected to landing page and cannot access protected routes

### Implementation

- [ ] T048 [US6] Create SignOutButton component with logoutRedirect in src/web/src/components/auth/SignOutButton.tsx
- [ ] T049 [US6] Add SignOutButton to user menu or header in src/web/src/components/layout/Header.tsx (or equivalent)
- [ ] T050 [US6] Add unit test for SignOutButton component in src/web/src/components/auth/SignOutButton.test.tsx

**Checkpoint**: Users can sign out - US6 complete

---

## Phase 7: User Story 7 - Auth Error Handling (Priority: P2)

**Goal**: Frontend gracefully handles 401 and 403 responses with appropriate user feedback

**Independent Test**: Simulate 401 → user prompted to sign in; simulate 403 → permission message displayed

### Implementation

- [ ] T051 [US7] Create useAuthErrorHandler hook for intercepting 401/403 in src/web/src/hooks/useAuthErrorHandler.ts
- [ ] T052 [US7] Update API client to use error handler hook in src/web/src/lib/api.ts
- [ ] T053 [P] [US7] Create AuthErrorBoundary component for displaying auth errors in src/web/src/components/auth/AuthErrorBoundary.tsx
- [ ] T054 [US7] Add unit test for auth error handling in src/web/src/hooks/useAuthErrorHandler.test.ts

**Checkpoint**: Auth errors handled gracefully - US7 complete

---

## Phase 8: Polish & Documentation

**Purpose**: Documentation, logging, and final verification

### Documentation

- [ ] T055 [P] Create External ID setup guide at docs/auth/external-id-setup.md (copy from quickstart.md with production additions)
- [ ] T056 [P] Create troubleshooting guide at docs/auth/troubleshooting.md

### Observability

- [ ] T057 Add authentication failure logging (401/403) with OpenTelemetry in src/Recall.Core.Api/Program.cs
- [ ] T058 [P] Add sign-in/sign-out event logging in frontend in src/web/src/hooks/useAuth.ts

### Final Verification

- [ ] T059 Run all backend tests and verify pass
- [ ] T060 [P] Run all frontend tests and verify pass
- [ ] T061 Run quickstart.md validation (manual end-to-end flow)
- [ ] T062 Verify no secrets committed to source control

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──────────────────────────────────────────────────────┐
                                                                     │
Phase 2: Foundational ◄──────────────────────────────────────────────┘
    │
    ├─► Phase 3: US3+US5 (API Protection + Data Isolation) ──► Phase 4: US4 (/me endpoint)
    │
    └─► Phase 5: US1+US2 (Sign-up/Sign-in) ──► Phase 6: US6 (Sign-out) ──► Phase 7: US7 (Error Handling)
                                                                              │
Phase 8: Polish ◄─────────────────────────────────────────────────────────────┘
```

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|-------|------------|---------------------|
| US3 (API Protection) | Phase 2 | US5 (same phase) |
| US5 (Data Isolation) | Phase 2 | US3 (same phase) |
| US4 (/me endpoint) | US3 (auth required) | - |
| US1 (Sign-up) | Phase 2 | US2 (same phase) |
| US2 (Sign-in) | Phase 2 | US1 (same phase) |
| US6 (Sign-out) | US1, US2 | - |
| US7 (Error Handling) | US1, US2 | - |

### Parallel Opportunities

**Within Phase 1 (Setup)**:
```
T003 (appsettings) ║ T004 (.env.example) ║ T005 (.gitignore) ║ T006 (docs dir)
```

**Within Phase 2 (Foundational)**:
```
T011 (IUserContext) ║ T012 (HttpUserContext)
T014 (Item.UserId) ║ T015 (Collection.UserId)
```

**Within Phase 3 (US3+US5)**:
```
T019+T020 (Collection repo) ║ T023+T024 (Collection service)
T027 (Items auth) ║ T028 (Collections auth) ║ T029 (Tags auth)
T030 (401 test) ║ T031 (403 test) ║ T032 (isolation test)
```

**Within Phase 5 (US1+US2)**:
```
T041 (SignInButton) ║ T042 (AuthGuard) ║ T043 (UserDisplay)
T046 (SignInButton test) ║ T047 (AuthGuard test)
```

---

## Implementation Strategy

### MVP First (Backend Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US3 + US5 (API protected, data isolated)
4. Complete Phase 4: US4 (/me endpoint)
5. **STOP and VALIDATE**: Test backend with curl/Postman using test bypass header
6. Backend MVP ready for frontend integration

### Full MVP (Backend + Frontend Auth)

1. Complete Phases 1-4 (Backend MVP)
2. Complete Phase 5: US1 + US2 (Frontend sign-in working)
3. **STOP and VALIDATE**: Full end-to-end flow with External ID
4. Application usable by authenticated users

### Complete Feature

1. Complete Phases 1-5 (Full MVP)
2. Complete Phase 6: US6 (Sign-out)
3. Complete Phase 7: US7 (Error handling)
4. Complete Phase 8: Polish & Documentation
5. Feature complete per specification

---

## Task Summary

| Phase | Tasks | Parallel Tasks |
|-------|-------|----------------|
| 1. Setup | T001-T006 (6) | 4 |
| 2. Foundational | T007-T016 (10) | 4 |
| 3. US3+US5 | T017-T032 (14) | 8 |
| 4. US4 | T033-T035 (3) | 0 |
| 5. US1+US2 | T036-T047 (12) | 6 |
| 6. US6 | T048-T050 (3) | 0 |
| 7. US7 | T051-T054 (4) | 1 |
| 8. Polish | T055-T062 (8) | 4 |
| **Total** | **60 tasks** | **27 parallelizable** |

### Tasks per User Story

| User Story | Tasks | Description |
|------------|-------|-------------|
| US1 (Sign-up) | 9 | MSAL config, auth components, tests |
| US2 (Sign-in) | 3 | Token attachment, user display |
| US3 (API Protection) | 6 | Auth middleware, endpoint auth, tests |
| US4 (/me endpoint) | 3 | Endpoint implementation, test |
| US5 (Data Isolation) | 9 | Repository + service userId filtering, test |
| US6 (Sign-out) | 3 | Sign-out component, test |
| US7 (Error Handling) | 4 | Error handler, boundary, test |
| Shared/Infra | 23 | Setup, foundational, docs, verification |

---

## Notes

- All [P] tasks can run in parallel (different files, no dependencies)
- [US#] labels map to spec.md user stories for traceability
- Test bypass (T009, T010) enables integration testing without External ID tokens
- Phase 3 backend changes are prerequisites for Phase 5 frontend
- Commit after each logical group of tasks
- Verify build passes after each phase completion

---

## Status

- in-progress

---

## Dev Agent Record

### File List

- .gitignore
- src/web/.env.example
- src/Recall.Core.Api/Program.cs
- src/tests/Recall.Core.Api.Tests/Auth/UnauthorizedTests.cs
- src/tests/Recall.Core.Api.Tests/Auth/DataIsolationTests.cs
- specs/004-entra-external-auth/tasks.md

---

## Senior Developer Review (AI)

- 2026-01-24: Fixed scope validation for space-delimited `scp` claims, added invalid-token 401 test, expanded data isolation tests to collections/tags, and ensured `.env.example` is tracked with aligned variable names.

---

## Change Log

- 2026-01-24: Review fixes applied (scope policy, auth tests, data isolation coverage, `.env.example` tracking and content).
