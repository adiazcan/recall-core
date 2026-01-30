# Tasks: Azure Infrastructure Landing Zone

**Status**: in-progress

**Input**: Design documents from `/specs/007-infra-azure/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: No automated tests requested - validation via deployment verification and quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Structure)

**Purpose**: Create infrastructure directory structure and base configurations

- [X] T001 Create infra directory structure with modules folders in infra/
- [X] T002 [P] Create parameter files structure in infra/parameters/dev.bicepparam and infra/parameters/prod.bicepparam
- [X] T003 [P] Create helper scripts directory structure in infra/scripts/

---

## Phase 2: Foundational (Core Bicep Modules)

**Purpose**: Core infrastructure modules that MUST be complete before ANY user story infrastructure can be deployed

**⚠️ CRITICAL**: No user story work can begin until these foundational modules are complete

- [X] T004 Implement resource-group module in infra/modules/core/resource-group.bicep
- [X] T005 [P] Implement log-analytics module in infra/modules/core/log-analytics.bicep
- [X] T006 [P] Implement key-vault module in infra/modules/core/key-vault.bicep
- [X] T007 [P] Implement app-configuration module in infra/modules/core/app-configuration.bicep
- [X] T008 [P] Implement container-registry module in infra/modules/container/container-registry.bicep
- [X] T009 Implement app-insights module in infra/modules/core/app-insights.bicep (depends on T005)

**Checkpoint**: Core modules ready - user story-specific modules can now be implemented

---

## Phase 3: User Story 1 - One-Command Infrastructure Deployment (Priority: P1) 🎯 MVP

**Goal**: Provision all Azure resources for an environment with a single command

**Independent Test**: Run `az deployment sub what-if` and verify all resources are listed; then deploy to an empty resource group and validate all resources are created

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement storage-account module in infra/modules/storage/storage-account.bicep
- [X] T011 [P] [US1] Implement storage-roles module in infra/modules/storage/storage-roles.bicep
- [X] T012 [P] [US1] Implement documentdb module in infra/modules/database/documentdb.bicep
- [X] T013 [P] [US1] Implement container-apps-env module in infra/modules/container/container-apps-env.bicep
- [X] T014 [P] [US1] Implement static-web-app module in infra/modules/web/static-web-app.bicep
- [X] T015 [US1] Implement container-app-api module in infra/modules/container/container-app-api.bicep
- [X] T016 [US1] Implement container-app-job module in infra/modules/container/container-app-job.bicep
- [X] T017 [US1] Create main.bicep entry point that orchestrates all modules in infra/main.bicep
- [X] T018 [US1] Create dev parameter file with environment-specific values in infra/parameters/dev.bicepparam
- [X] T019 [US1] Create prod parameter file with environment-specific values in infra/parameters/prod.bicepparam
- [X] T020 [P] [US1] Create deploy.sh helper script in infra/scripts/deploy.sh
- [X] T021 [P] [US1] Create what-if.sh preview script in infra/scripts/what-if.sh
- [ ] T022 [US1] Validate deployment with what-if against dev environment

**Checkpoint**: At this point, User Story 1 should be fully functional - single command provisions all resources

---

## Phase 4: User Story 2 - API Deployment to Container Apps (Priority: P1)

**Goal**: API deployed to Azure Container Apps and accessible via HTTPS

**Independent Test**: Deploy API container to ACA and verify `/health` endpoint returns HTTP 200

### Implementation for User Story 2

- [X] T023 [US2] Create Dockerfile for API if not exists in src/Recall.Core.Api/Dockerfile
- [X] T024 [US2] Configure API Container App health probes in infra/modules/container/container-app-api.bicep
- [X] T025 [US2] Add Key Vault secret reference for DocumentDB connection in API module
- [X] T026 [US2] Add App Configuration integration for API module
- [X] T027 [US2] Add managed identity configuration and RBAC role assignments for API
- [ ] T028 [US2] Verify API can be manually deployed to ACA and responds at /health endpoint

**Checkpoint**: API Container App is deployable and accessible via HTTPS with health checks

---

## Phase 5: User Story 3 - Frontend Deployment to Static Web Apps (Priority: P1)

**Goal**: Web application available via a public URL with API routing

**Independent Test**: Deploy SWA and verify application loads in browser; test API calls route correctly

### Implementation for User Story 3

 - [X] T029 [US3] Configure SWA linked backend for API routing in infra/modules/web/static-web-app.bicep
 - [X] T030 [US3] Create staticwebapp.config.json for route configuration in src/web/staticwebapp.config.json
 - [X] T031 [US3] Document CORS fallback for dev environment (Free SKU) in docs/infra/swa-cors-fallback.md
- [ ] T032 [US3] Verify SWA deployment and frontend loads in browser

**Checkpoint**: Frontend is accessible and can call API without CORS errors

---

## Phase 6: User Story 4 - Database Connectivity (Priority: P1)

**Goal**: API connects to Azure DocumentDB and persists data

**Independent Test**: Deploy API and verify it can write and read a document from DocumentDB

### Implementation for User Story 4

- [X] T033 [US4] Configure DocumentDB firewall rules for Azure services in infra/modules/database/documentdb.bicep
- [X] T034 [US4] Store DocumentDB connection string in Key Vault via Bicep
- [X] T035 [US4] Configure API to retrieve connection string from Key Vault via managed identity
- [ ] T036 [US4] Verify API connects to DocumentDB on startup and can perform CRUD operations

**Checkpoint**: API persists data to DocumentDB and retrieves it after restart

---

## Phase 7: User Story 5 - Storage Queue Messaging (Priority: P2)

**Goal**: Background jobs triggered by Azure Storage Queue messages

**Independent Test**: Send a message to the queue and verify Container Apps Job processes it

### Implementation for User Story 5

- [X] T037 [US5] Configure Storage Queue in storage-account module
- [X] T038 [US5] Configure ACA Job with Storage Queue trigger in container-app-job module
- [X] T039 [US5] Create Dockerfile for enrichment job in src/Recall.Core.Enrichment/Dockerfile
- [X] T040 [US5] Add managed identity and RBAC role assignments for enrichment job
- [X] T041 [US5] Configure job scaling rules (0-5 executions, polling interval)
- [ ] T042 [US5] Verify queue message triggers job execution

**Checkpoint**: Messages sent to queue are processed by enrichment job

---

## Phase 8: User Story 6 - Blob Storage for Assets (Priority: P2)

**Goal**: API stores and retrieves thumbnails from Azure Blob Storage

**Independent Test**: Upload a blob via API and verify it can be retrieved

### Implementation for User Story 6

- [X] T043 [US6] Configure thumbnails blob container in storage-account module
- [X] T044 [US6] Add Blob Data Contributor role to API managed identity
- [X] T045 [US6] Add Blob Data Contributor role to enrichment job managed identity
- [ ] T046 [US6] Verify API can upload and retrieve blobs from storage

**Checkpoint**: Thumbnails are stored and retrievable from blob storage

---

## Phase 9: User Story 7 - Observability via Application Insights (Priority: P2)

**Goal**: View traces, metrics, and logs in Application Insights

**Independent Test**: Make API requests and verify traces appear in Application Insights within 5 minutes

### Implementation for User Story 7

- [X] T047 [US7] Configure Application Insights connection string in API container app
- [X] T048 [US7] Configure Application Insights connection string in enrichment job
- [X] T049 [US7] Add Azure.Monitor.OpenTelemetry.AspNetCore package to API project (if not present)
- [X] T050 [US7] Implement alerts module for prod environment in infra/modules/core/alerts.bicep
- [ ] T051 [US7] Verify traces and logs appear in Application Insights

**Checkpoint**: Distributed traces and logs visible in Application Insights

---

## Phase 10: User Story 8 - CI/CD Workflow Deployment (Priority: P2)

**Goal**: GitHub Actions workflows deploy infrastructure and applications

**Independent Test**: Trigger deployment workflow and verify resources are provisioned

### Implementation for User Story 8

- [ ] T052 [US8] Create infrastructure deployment workflow in .github/workflows/infra-deploy.yml
- [X] T052 [US8] Create infrastructure deployment workflow in .github/workflows/infra-deploy.yml
- [X] T053 [P] [US8] Create API deployment workflow in .github/workflows/api-deploy.yml
- [X] T054 [P] [US8] Create enrichment deployment workflow in .github/workflows/enrichment-deploy.yml
- [X] T055 [P] [US8] Create web deployment workflow in .github/workflows/web-deploy.yml
- [X] T056 [US8] Create reusable Azure login workflow in .github/workflows/reusable-azure-login.yml
- [X] T057 [US8] Create reusable Docker build workflow in .github/workflows/reusable-docker-build.yml
- [X] T058 [US8] Document GitHub OIDC setup and environment configuration in docs/infra/github-oidc-setup.md
- [ ] T059 [US8] Verify infrastructure workflow deploys dev environment successfully

**Checkpoint**: All workflows execute successfully and deploy to Azure

---

## Phase 11: Polish & Documentation

**Purpose**: Operational documentation and cross-cutting improvements

- [X] T060 [P] Create infrastructure overview documentation in docs/infra/overview.md
- [X] T061 [P] Create operational runbook in docs/infra/runbook.md
- [X] T062 [P] Create cost documentation in docs/infra/cost.md
- [ ] T063 Run quickstart.md validation for full deployment
- [X] T064 Update repository README with infrastructure deployment instructions

### Review Follow-ups (AI)

- [ ] [AI-Review][High] Create the `recall` database during DocumentDB provisioning to satisfy FR-021 [infra/modules/database/documentdb.bicep:38-76]
- [ ] [AI-Review][High] Add App Configuration integration and role assignment for the enrichment job (App Configuration endpoint env + Data Reader role) to satisfy FR-035/FR-039 [infra/modules/container/container-app-job.bicep:131-188]
- [ ] [AI-Review][High] Define API Container App scale rules (not just min/max replicas) to satisfy FR-009 [infra/modules/container/container-app-api.bicep:150-156]
- [ ] [AI-Review][High] Add secret rotation procedures to the runbook to satisfy FR-048 [docs/infra/runbook.md:26-29]
- [ ] [AI-Review][Medium] Document upgrade path for Private Link, VNet integration, and multi-region to satisfy FR-050 [docs/infra/overview.md]
- [ ] [AI-Review][Medium] Add alerts for latency/dependency failure/job failure to better align with FR-028 [infra/modules/core/alerts.bicep]
- [ ] [AI-Review][Medium] Resolve storage shared-key auth discrepancy (either disable shared key or update docs/job auth pattern) [docs/infra/overview.md, infra/modules/storage/storage-account.bicep]
- [ ] [AI-Review][Medium] Align OpenTelemetry/Azure Monitor package versions with repo guidance (OpenTelemetry 1.10.0) [src/Recall.Core.ServiceDefaults/Recall.Core.ServiceDefaults.csproj, src/Recall.Core.Api/Recall.Core.Api.csproj]
- [ ] [AI-Review][Medium] Fix duplicate task entry for T052 to remove ambiguity [specs/007-infra-azure/tasks.md:186-188]
- [ ] [AI-Review][Medium] Add Dev Agent Record file list to document changed files for traceability [specs/007-infra-azure/tasks.md]

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user story Bicep modules
- **User Story 1 (Phase 3)**: Depends on Phase 2 - Creates the main.bicep orchestration
- **User Stories 2-7 (Phases 4-9)**: Each depends on US1 infrastructure being deployable
  - US2, US3, US4 are P1 - should complete first
  - US5, US6, US7 are P2 - can proceed after P1 stories
- **User Story 8 (Phase 10)**: Depends on infrastructure being deployable (US1)
- **Polish (Phase 11)**: Depends on all features being complete

### User Story Dependencies

- **User Story 1 (P1)**: Infrastructure provisioning - foundational for all others
- **User Story 2 (P1)**: API deployment - needs US1 infrastructure
- **User Story 3 (P1)**: Frontend deployment - needs US1 infrastructure, integrates with US2
- **User Story 4 (P1)**: Database connectivity - needs US1 infrastructure, integrates with US2
- **User Story 5 (P2)**: Queue messaging - needs US1 infrastructure
- **User Story 6 (P2)**: Blob storage - needs US1 infrastructure
- **User Story 7 (P2)**: Observability - needs US1 infrastructure, enhances US2/US5
- **User Story 8 (P2)**: CI/CD workflows - needs US1 infrastructure deployable

### Parallel Opportunities per Phase

**Phase 1: Setup**
```bash
T001  # Must complete first (creates directory structure)
T002, T003  # Can run in parallel after T001
```

**Phase 2: Foundational**
```bash
T004  # Resource group module first
T005, T006, T007, T008  # Can run in parallel after T004
T009  # Depends on T005 (Log Analytics)
```

**Phase 3: User Story 1**
```bash
T010, T011, T012, T013, T014  # All module implementations in parallel
T015, T016  # Container app modules (can parallel with above)
T017  # Main.bicep orchestration (after all modules)
T018, T019, T020, T021  # Parameter files and scripts in parallel
T022  # Validation (after all above)
```

**Phase 10: User Story 8**
```bash
T052  # Main infrastructure workflow first
T053, T054, T055  # All deployment workflows in parallel
T056, T057  # Reusable workflows in parallel
T058  # Documentation can parallel
T059  # Validation last
```

---

## Implementation Strategy

### MVP First (P1 User Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational modules
3. Complete Phase 3: User Story 1 (Infrastructure Deployment)
4. **STOP and VALIDATE**: Deploy infrastructure to dev, verify all resources created
5. Complete Phase 4: User Story 2 (API Deployment)
6. Complete Phase 5: User Story 3 (Frontend Deployment)
7. Complete Phase 6: User Story 4 (Database Connectivity)
8. **MVP COMPLETE**: Full stack deployable and functional

### Incremental Delivery

1. Complete Setup + Foundational → Core modules ready
2. Complete US1 → Deploy infrastructure (MVP infrastructure!)
3. Complete US2 → API running in Azure
4. Complete US3 → Frontend accessible
5. Complete US4 → Full CRUD functionality
6. Add US5, US6 → Background processing + blob storage
7. Add US7 → Production observability
8. Add US8 → Automated CI/CD

### Parallel Team Strategy

With multiple developers working on Bicep modules:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: Storage and Database modules (T010-T012)
   - Developer B: Container modules (T013-T016)
   - Developer C: Web module + main.bicep (T014, T017)
3. Integrate all modules into main.bicep
4. Validate together

---

## Notes

- All Bicep modules follow Azure Verified Modules (AVM) patterns from research.md
- System-assigned managed identities used for all container apps
- RBAC-only access for Key Vault (no access policies)
- dev uses Free/Basic SKUs; prod uses Standard SKUs
- DocumentDB admin password must be provided at deployment time (not stored in repo)
- SWA linked backend requires Standard SKU (prod only); dev falls back to CORS
- Container Apps Job uses queue trigger with scale-to-zero
- All resources tagged with environment, project, managedBy, costCenter

---

## Task Summary

| Phase | Story | Task Count | Parallel Tasks |
|-------|-------|------------|----------------|
| 1 | Setup | 3 | 2 |
| 2 | Foundational | 6 | 4 |
| 3 | US1 - Infrastructure | 13 | 7 |
| 4 | US2 - API Deployment | 6 | 0 |
| 5 | US3 - Frontend | 4 | 0 |
| 6 | US4 - Database | 4 | 0 |
| 7 | US5 - Queue/Job | 6 | 0 |
| 8 | US6 - Blob Storage | 4 | 0 |
| 9 | US7 - Observability | 5 | 0 |
| 10 | US8 - CI/CD | 8 | 4 |
| 11 | Polish | 5 | 3 |
| **Total** | | **64** | **20** |

---

## Senior Developer Review (AI)

Date: 2026-01-30

Summary: Review completed; 4 high-severity and 5 medium-severity gaps found against FRs and documentation requirements. See “Review Follow-ups (AI)” for action items.

---

## Change Log

- 2026-01-30: Added AI review follow-ups, review summary, and set status to in-progress.
