# Implementation Plan: Azure Infrastructure Landing Zone

**Branch**: `007-azure-infra` | **Date**: 2026-01-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-azure-infra/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Provision and deploy recall-core to Azure using Terraform IaC with:
- API on Azure Container Apps (ACA) with managed identity
- Frontend on Azure Static Web Apps (SWA) with API backend linking
- Azure DocumentDB (MongoDB-compatible) for persistence
- Azure Storage (Blob + Queue) for assets and messaging
- Azure Container Apps Jobs for event-driven queue processing
- Application Insights + OpenTelemetry for observability
- Key Vault for secrets management with RBAC
- GitHub Actions workflows for automated provisioning and deployment

## Technical Context

**IaC Tool**: Terraform (user-specified, azurerm provider)  
**Backend Language/Version**: .NET 10 minimal API  
**Frontend Language/Version**: TypeScript / React 19 / Vite 6  
**Primary Dependencies**: Aspire 13, Dapr 1.14, MongoDB.Driver 2.30, Azure.Storage.Blobs 12.23, OpenTelemetry  
**Storage**: Azure DocumentDB (MongoDB API), Azure Blob Storage, Azure Storage Queue  
**Testing**: xUnit (backend), Vitest (frontend), Playwright (e2e)  
**Target Platform**: Azure (ACA + SWA + DocumentDB + Storage + App Insights)  
**Project Type**: Web (frontend + backend + enrichment worker)  
**Performance Goals**: API health <60s post-deploy, infra provisioning <20min  
**Constraints**: Cost-conscious SKUs for dev (single user prod), OpenTelemetry export to Azure Monitor  
**Scale/Scope**: 2 environments (dev/prod), 1 primary user for production initially  

**Environments**:
- `dev`: Lower SKUs, minimal replicas, public networking
- `prod`: Production-ready SKUs, auto-scaling, same architecture

**Region Strategy**: Single region per environment (Sweden Central recommended for cost/availability balance)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Product Focus | ✅ PASS | Infrastructure enables core save/read/find functionality; no scope creep |
| II. Privacy-First | ✅ PASS | Key Vault for secrets, MI for auth; MVP allows public endpoints for DocumentDB/Storage with firewall rules planned for later phases |
| III. Code Quality | ✅ PASS | IaC follows modular structure (modules per resource type) |
| IV. Testing Discipline | ✅ PASS | Terraform validate/plan in CI, deployment verification tests |
| V. Performance | ✅ PASS | ACA scaling configured, queue-triggered jobs for async work |
| VI. Reliability | ✅ PASS | Health checks, queue retries, circuit breakers via ACA configuration |
| VII. User Experience | N/A | Infrastructure layer - UX handled by frontend spec |
| VIII. Observability | ✅ PASS | App Insights + OpenTelemetry, Log Analytics workspace, structured logging |
| IX. Development Workflow | ✅ PASS | GitHub Actions workflows for infra and app deployment |

**Gates Verified**:
- [x] Feature aligns with Product Focus (minimal scope)?
- [x] Privacy requirements addressed (Key Vault RBAC, storage private access disabled)?
- [x] Architecture follows modular structure (Terraform modules)?
- [x] Deployment verification defined?
- [x] Performance budget established (infra <20min, health <60s)?
- [x] Reliability patterns included (scaling, retries, health checks)?
- [x] Observability hooks planned (App Insights, OpenTelemetry)?

## Project Structure

### Documentation (this feature)

```text
specs/007-azure-infra/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output - OpenAPI/Terraform interface specs
│   └── terraform-outputs.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Infrastructure as Code
infra/
├── main.tf                    # Root module composition
├── variables.tf               # Input variables (env, region, etc.)
├── outputs.tf                 # Output values (endpoints, connection strings)
├── providers.tf               # Azure provider configuration
├── backend.tf                 # Remote state configuration
├── environments/
│   ├── dev.tfvars            # Dev environment values
│   └── prod.tfvars           # Prod environment values
└── modules/
    ├── resource-group/        # Resource group creation
    ├── monitoring/            # Log Analytics + App Insights
    ├── keyvault/              # Key Vault with RBAC
    ├── storage/               # Storage Account + Blob + Queue
    ├── documentdb/            # Azure DocumentDB (MongoDB)
    ├── container-apps/        # ACA Environment + Apps + Jobs
    └── static-web-app/        # SWA resource

# GitHub Actions Workflows
.github/workflows/
├── infra-deploy.yml           # Terraform plan/apply workflow
├── api-deploy.yml             # Build & deploy API container
├── enrichment-deploy.yml      # Build & deploy Enrichment container
└── web-deploy.yml             # Deploy SWA frontend

# Container configuration
src/
├── Recall.Core.Api/
│   └── Dockerfile            # API container image
└── Recall.Core.Enrichment/
    └── Dockerfile            # Enrichment worker container image

# Runbook documentation
docs/
└── azure/
    ├── deployment-runbook.md  # Deployment procedures
    ├── monitoring-runbook.md  # Observability guide
    └── troubleshooting.md     # Common issues and fixes
```

**Structure Decision**: Terraform modules pattern with environment-specific tfvars files. Root module composes all modules with explicit dependencies. GitHub Actions workflows separate infrastructure deployment from application deployment for independent release cycles.

## Complexity Tracking

> **No violations detected** - infrastructure scope is appropriate for the requirements.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| IaC Tool | Terraform | User-specified; portable, mature Azure provider |
| Module Structure | Flat modules | Simple composition; one module per Azure resource type |
| Environments | dev/prod | Minimal viable; dev for testing, prod for single user |
| Networking | Public endpoints | MVP simplicity; private endpoints deferred for cost/complexity |
| Queue Processing | ACA Jobs | Event-driven serverless; no permanent worker cost |

## Naming Convention

**Pattern**: `{project}-{resource}-{env}` (short, deterministic)

| Resource Type | Pattern | Example (dev) | Example (prod) |
|---------------|---------|---------------|----------------|
| Resource Group | `recall-{env}-rg` | `recall-dev-rg` | `recall-prod-rg` |
| Container Apps Env | `recall-{env}-cae` | `recall-dev-cae` | `recall-prod-cae` |
| Container App (API) | `recall-api-{env}` | `recall-api-dev` | `recall-api-prod` |
| Container App Job | `recall-job-{env}` | `recall-job-dev` | `recall-job-prod` |
| Static Web App | `recall-web-{env}` | `recall-web-dev` | `recall-web-prod` |
| Storage Account | `recall{env}st` | `recalldevst` | `recallprodst` |
| Key Vault | `recall-{env}-kv` | `recall-dev-kv` | `recall-prod-kv` |
| DocumentDB | `recall-{env}-docdb` | `recall-dev-docdb` | `recall-prod-docdb` |
| App Insights | `recall-{env}-ai` | `recall-dev-ai` | `recall-prod-ai` |
| Log Analytics | `recall-{env}-law` | `recall-dev-law` | `recall-prod-law` |
| ACR | `recallacr` | `recallacr` | `recallacr` (shared) |

**Tags** (applied to all resources):
```hcl
tags = {
  project     = "recall-core"
  environment = var.environment
  managed_by  = "terraform"
}
```

## SKU Baselines

| Resource | Dev SKU | Prod SKU | Rationale |
|----------|---------|----------|-----------|
| DocumentDB | M25 (2 vCores, 8GB RAM, 32GB storage) | M25 (same, single user) | Cost-effective vCore tier for low traffic |
| ACA Environment | Consumption | Consumption | Pay-per-use, no idle cost |
| Container App | 0.25 vCPU / 0.5GB | 0.5 vCPU / 1GB | Right-sized for API workload |
| Storage Account | Standard_LRS | Standard_LRS | Sufficient for single-user thumbnails |
| Key Vault | Standard | Standard | No premium features needed |
| App Insights | Pay-as-you-go | Pay-as-you-go | Usage-based billing |

## Managed Identity Strategy

| Identity | Type | Purpose | RBAC Assignments |
|----------|------|---------|------------------|
| recall-api-{env} | System-assigned | API container app | Storage Blob Data Contributor, Storage Queue Data Contributor, Key Vault Secrets User |
| recall-job-{env} | System-assigned | Enrichment job | Storage Blob Data Contributor, Storage Queue Data Contributor, Key Vault Secrets User |

---

## Post-Design Constitution Check (Phase 1 Complete)

*Re-evaluated after Phase 1 design artifacts completed.*

| Principle | Status | Design Artifacts Reviewed |
|-----------|--------|---------------------------|
| I. Product Focus | ✅ PASS | data-model.md - minimal resource topology, no extras |
| II. Privacy-First | ✅ PASS | contracts/ - Key Vault RBAC, storage private, no public secrets |
| III. Code Quality | ✅ PASS | data-model.md - modular Terraform structure, clear interfaces |
| IV. Testing Discipline | ✅ PASS | contracts/workflows.md - terraform validate in CI |
| V. Performance | ✅ PASS | research.md - consumption tiers, scale-to-zero configured |
| VI. Reliability | ✅ PASS | data-model.md - health checks, retry policies documented |
| VII. User Experience | N/A | Infrastructure layer |
| VIII. Observability | ✅ PASS | research.md - OTel + App Insights integration planned |
| IX. Development Workflow | ✅ PASS | contracts/workflows.md - 4 workflows for full CI/CD |

**All gates verified - ready for Phase 2 task breakdown.**
