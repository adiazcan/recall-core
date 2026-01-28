# Tasks: Azure Infrastructure Landing Zone

**Input**: Design documents from `/specs/007-azure-infra/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not explicitly requested - skipped.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create Terraform project structure and configuration scaffolding

- [x] T001 Create infra directory structure per plan.md in infra/
- [x] T002 [P] Create Terraform provider configuration in infra/providers.tf (azurerm, azapi providers)
- [x] T003 [P] Create Terraform backend configuration in infra/backend.tf (Azure Storage backend)
- [x] T004 [P] Create root module variables definition in infra/variables.tf
- [x] T005 [P] Create dev environment values in infra/environments/dev.tfvars
- [x] T006 [P] Create prod environment values in infra/environments/prod.tfvars
- [x] T007 Create locals definition with common tags in infra/main.tf

---

## Phase 2: Foundational (Bootstrap Prerequisites)

**Purpose**: One-time bootstrap resources that MUST exist before environment provisioning

**⚠️ CRITICAL**: These are typically created manually or via separate bootstrap scripts before the main Terraform can run

- [x] T008 Document bootstrap procedure for Terraform state storage in docs/azure/deployment-runbook.md
- [x] T009 Create bootstrap script for state storage account in infra/scripts/bootstrap-state.sh
- [x] T010 [P] Create bootstrap script for shared ACR in infra/scripts/bootstrap-acr.sh
- [x] T011 [P] Create bootstrap script for OIDC federation setup in infra/scripts/bootstrap-oidc.sh
- [x] T012 Create API Dockerfile in src/Recall.Core.Api/Dockerfile
- [x] T013 [P] Create Enrichment Dockerfile in src/Recall.Core.Enrichment/Dockerfile

**Checkpoint**: Bootstrap resources ready - Terraform modules can now be developed

---

## Phase 3: User Story 1 - One-Command Infrastructure Deployment (Priority: P1) 🎯 MVP

**Goal**: Provision all Azure resources for an environment with terraform apply

**Independent Test**: Run `terraform plan -var-file="environments/dev.tfvars"` and verify all resources are planned

### Terraform Modules for User Story 1

- [x] T014 [US1] Create resource-group module in infra/modules/resource-group/main.tf
- [x] T015 [P] [US1] Create resource-group module variables in infra/modules/resource-group/variables.tf
- [x] T016 [P] [US1] Create resource-group module outputs in infra/modules/resource-group/outputs.tf
- [x] T017 [US1] Create monitoring module (LAW + App Insights) in infra/modules/monitoring/main.tf
- [x] T018 [P] [US1] Create monitoring module variables in infra/modules/monitoring/variables.tf
- [x] T019 [P] [US1] Create monitoring module outputs in infra/modules/monitoring/outputs.tf
- [x] T020 [US1] Create keyvault module in infra/modules/keyvault/main.tf
- [x] T021 [P] [US1] Create keyvault module variables in infra/modules/keyvault/variables.tf
- [x] T022 [P] [US1] Create keyvault module outputs in infra/modules/keyvault/outputs.tf
- [x] T023 [US1] Create storage module (blob + queue) in infra/modules/storage/main.tf
- [x] T024 [P] [US1] Create storage module variables in infra/modules/storage/variables.tf
- [x] T025 [P] [US1] Create storage module outputs in infra/modules/storage/outputs.tf
- [x] T026 [US1] Create documentdb module (MongoDB vCore) in infra/modules/documentdb/main.tf
- [x] T027 [P] [US1] Create documentdb module variables in infra/modules/documentdb/variables.tf
- [x] T028 [P] [US1] Create documentdb module outputs in infra/modules/documentdb/outputs.tf
- [x] T029 [US1] Create container-apps module (ACA env + API app + Job) in infra/modules/container-apps/main.tf
- [x] T030 [P] [US1] Create container-apps module variables in infra/modules/container-apps/variables.tf
- [x] T031 [P] [US1] Create container-apps module outputs in infra/modules/container-apps/outputs.tf
- [x] T032 [US1] Create static-web-app module in infra/modules/static-web-app/main.tf
- [x] T033 [P] [US1] Create static-web-app module variables in infra/modules/static-web-app/variables.tf
- [x] T034 [P] [US1] Create static-web-app module outputs in infra/modules/static-web-app/outputs.tf
- [x] T035 [US1] Compose all modules in root module in infra/main.tf
- [x] T036 [US1] Create root module outputs per contracts/terraform-outputs.md in infra/outputs.tf
- [x] T037 [US1] Add RBAC role assignments for managed identities in infra/modules/container-apps/rbac.tf

**Checkpoint**: `terraform plan` shows all resources; `terraform apply` provisions full environment

---

## Phase 4: User Story 2 - API Deployment to Azure Container Apps (Priority: P1)

**Goal**: Deploy API container to ACA with HTTPS ingress and health endpoint

**Independent Test**: After deployment, `curl https://<api-fqdn>/health` returns HTTP 200

### Implementation for User Story 2

- [x] T038 [US2] Configure API Container App with HTTPS ingress in infra/modules/container-apps/main.tf (api resource)
- [x] T039 [US2] Configure API scaling rules (min/max replicas) in infra/modules/container-apps/main.tf
- [x] T040 [US2] Configure API environment variables (App Insights, Storage, DocumentDB secrets) in infra/modules/container-apps/main.tf
- [x] T041 [US2] Configure API health probes (liveness, readiness) in infra/modules/container-apps/main.tf
- [x] T042 [US2] Create GitHub Actions workflow for API deployment in .github/workflows/api-deploy.yml

**Checkpoint**: API container deployed and responding to health checks via HTTPS

---

## Phase 5: User Story 3 - Frontend Deployment to Static Web Apps (Priority: P1)

**Goal**: Deploy React SPA to SWA with linked backend to API

**Independent Test**: Open SWA URL in browser and verify app loads

### Implementation for User Story 3

- [x] T043 [US3] Configure SWA resource with Standard SKU in infra/modules/static-web-app/main.tf
- [x] T044 [US3] Configure SWA linked backend to API Container App in infra/modules/static-web-app/main.tf (azapi_resource)
- [x] T045 [US3] Create GitHub Actions workflow for web deployment in .github/workflows/web-deploy.yml

**Checkpoint**: Frontend accessible via HTTPS, API calls proxied via linked backend

---

## Phase 6: User Story 4 - Database Connectivity (Priority: P1)

**Goal**: API connects to Azure DocumentDB (MongoDB) and persists data

**Independent Test**: API writes a document and retrieves it after restart

**Note**: MongoDB collections are created by the application on first use; no Terraform provisioning required for collections.

### Implementation for User Story 4

- [x] T046 [US4] Configure DocumentDB MongoDB cluster (M25 tier) in infra/modules/documentdb/main.tf
- [x] T047 [US4] Store DocumentDB connection string in Key Vault in infra/modules/documentdb/main.tf
- [x] T048 [US4] Configure DocumentDB firewall rules (public access for MVP) in infra/modules/documentdb/main.tf
- [x] T049 [US4] Add Key Vault secret reference for DocumentDB in API container config in infra/modules/container-apps/main.tf

**Checkpoint**: API successfully connects to DocumentDB and persists data

---

## Phase 7: User Story 5 - Dapr Pub/Sub for Enrichment (Storage Queue-backed) (Priority: P2)

**Goal**: Configure Dapr pub/sub using Azure Storage Queues so the enrichment service processes `enrichment.requested` events

**Independent Test**: Publish `enrichment.requested` event via Dapr pub/sub and verify enrichment container app processes it

### Implementation for User Story 5

- [x] T050 [US5] Create Storage Queue resource used as Dapr pub/sub backing store in infra/modules/storage/main.tf
- [x] T051 [US5] Configure enrichment ACA container app with Dapr pub/sub component `enrichment-pubsub` (Storage Queue-backed) and subscription to topic `enrichment.requested` in infra/modules/container-apps/main.tf
- [x] T052 [US5] Configure enrichment container app environment variables/secrets for Storage Queue access (connection string, queue name) in infra/modules/container-apps/main.tf
- [x] T053 [US5] Create GitHub Actions workflow for enrichment service deployment (including Dapr pub/sub config) in .github/workflows/enrichment-deploy.yml

**Checkpoint**: Enrichment container app receives `enrichment.requested` events via Dapr pub/sub (Storage Queue-backed) and processes them

---

## Phase 8: User Story 6 - Blob Storage for Assets (Priority: P2)

**Goal**: API stores and retrieves thumbnails from Blob Storage

**Independent Test**: Upload blob via API, retrieve via SAS URL

### Implementation for User Story 6

- [x] T054 [US6] Create thumbnails blob container in infra/modules/storage/main.tf
- [x] T055 [US6] Configure blob container access level (private) in infra/modules/storage/main.tf
- [x] T056 [US6] Assign Storage Blob Data Contributor to API identity in infra/modules/container-apps/rbac.tf
- [x] T057 [US6] Configure Storage endpoints in API environment variables in infra/modules/container-apps/main.tf

**Checkpoint**: API can upload and retrieve blobs using managed identity

---

## Phase 9: User Story 7 - Observability via Application Insights (Priority: P2)

**Goal**: Traces, metrics, and logs appear in Application Insights

**Independent Test**: Make API request, verify trace in App Insights within 5 minutes

### Implementation for User Story 7
- [x] T058 [US7] Create Log Analytics Workspace in infra/modules/monitoring/main.tf
- [x] T059 [US7] Create workspace-based Application Insights in infra/modules/monitoring/main.tf
- [x] T060 [US7] Configure App Insights connection string in API container in infra/modules/container-apps/main.tf
- [x] T061 [US7] Configure App Insights connection string in Job container in infra/modules/container-apps/main.tf
- [x] T062 [US7] Document monitoring setup and queries in docs/azure/monitoring-runbook.md

**Checkpoint**: Distributed traces visible in Application Insights

---

## Phase 10: User Story 8 - CI/CD Workflow Deployment (Priority: P2)

**Goal**: GitHub Actions workflows automate infrastructure and app deployment

**Independent Test**: Trigger workflow, verify deployment completes

### Implementation for User Story 8

- [x] T063 [US8] Create GitHub Actions workflow for infrastructure deployment in .github/workflows/infra-deploy.yml
- [x] T064 [US8] Configure GitHub environments (dev, prod) with protection rules in docs/azure/deployment-runbook.md
- [x] T065 [US8] Document GitHub secrets configuration in docs/azure/deployment-runbook.md
- [x] T066 [US8] Add workflow trigger documentation to docs/azure/deployment-runbook.md

**Checkpoint**: All 4 workflows deployable via GitHub Actions

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and cleanup

- [x] T067 [P] Complete deployment runbook in docs/azure/deployment-runbook.md
- [x] T068 [P] Create troubleshooting guide in docs/azure/troubleshooting.md
- [x] T069 Run terraform fmt to format all Terraform files in infra/
- [x] T070 Run terraform validate to verify configuration in infra/
- [ ] T071 Execute quickstart.md validation steps manually
- [x] T072 Document resource naming convention and topology in docs/azure/deployment-runbook.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - creates bootstrap resources
- **US1 (Phase 3)**: Depends on Foundational - creates all Terraform modules
- **US2 (Phase 4)**: Depends on US1 (container-apps module exists)
- **US3 (Phase 5)**: Depends on US1 (static-web-app module exists), US2 (API for linked backend)
- **US4 (Phase 6)**: Depends on US1 (documentdb module exists)
- **US5 (Phase 7)**: Depends on US1 (storage, container-apps modules exist)
- **US6 (Phase 8)**: Depends on US1 (storage module exists)
- **US7 (Phase 9)**: Depends on US1 (monitoring module exists)
- **US8 (Phase 10)**: Depends on US2, US3, US5 (workflows reference deployed resources)
- **Polish (Phase 11)**: Depends on all user stories

### Module Build Order (within US1)

```
resource-group → monitoring
              → keyvault → documentdb
              → storage ─┬→ container-apps → static-web-app
                        └→ documentdb ────┘
```

### Parallel Opportunities

Within each phase, tasks marked [P] can run in parallel:

**Phase 1 (Setup)**:
- T002, T003, T004 (provider, backend, variables) - all parallel
- T005, T006 (tfvars) - parallel

**Phase 2 (Foundational)**:
- T010, T011 (ACR, OIDC scripts) - parallel
- T012, T013 (Dockerfiles) - parallel

**Phase 3 (US1) - Module variables/outputs parallel per module**:
- T015, T016 (resource-group vars/outputs)
- T018, T019 (monitoring vars/outputs)
- T021, T022 (keyvault vars/outputs)
- T024, T025 (storage vars/outputs)
- T027, T028 (documentdb vars/outputs)
- T030, T031 (container-apps vars/outputs)
- T033, T034 (static-web-app vars/outputs)

---

## Parallel Example: User Story 1 Modules

```bash
# After resource-group module is complete, these can run in parallel:
Task: "Create monitoring module in infra/modules/monitoring/main.tf"
Task: "Create keyvault module in infra/modules/keyvault/main.tf"
Task: "Create storage module in infra/modules/storage/main.tf"

# Within each module, vars/outputs can be parallel:
Task: "Create monitoring module variables in infra/modules/monitoring/variables.tf"
Task: "Create monitoring module outputs in infra/modules/monitoring/outputs.tf"
```

---

## Implementation Strategy

### MVP First (P1 User Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (bootstrap scripts)
3. Complete Phase 3: US1 - Infrastructure Deployment (all modules)
4. Complete Phase 4: US2 - API Deployment
5. Complete Phase 5: US3 - Frontend Deployment
6. Complete Phase 6: US4 - Database Connectivity
7. **STOP and VALIDATE**: Run end-to-end terraform apply, verify API and frontend work

### Incremental Delivery (Add P2 Stories)

8. Add Phase 7: US5 - Storage Queue
9. Add Phase 8: US6 - Blob Storage
10. Add Phase 9: US7 - Observability
11. Add Phase 10: US8 - CI/CD Workflows
12. Complete Phase 11: Polish

### Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Setup | T001-T007 | 1-2 hours |
| Foundational | T008-T013 | 2-3 hours |
| US1 (Infra) | T014-T037 | 6-8 hours |
| US2 (API) | T038-T042 | 2-3 hours |
| US3 (Frontend) | T043-T045 | 1-2 hours |
| US4 (Database) | T046-T049 | 2-3 hours |
| US5 (Queue) | T050-T053 | 2-3 hours |
| US6 (Blob) | T054-T057 | 1-2 hours |
| US7 (Observability) | T058-T062 | 2-3 hours |
| US8 (CI/CD) | T063-T066 | 2-3 hours |
| Polish | T067-T072 | 2-3 hours |
| **Total** | **72 tasks** | **~24-35 hours** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently testable after completion
- Terraform `azapi` provider required for DocumentDB (not yet in azurerm)
- SWA linked backend requires `azapi` provider (azurerm doesn't support it)
- Run `terraform fmt` and `terraform validate` frequently during development
- Commit after each module is complete and validated
