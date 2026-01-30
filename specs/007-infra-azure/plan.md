# Implementation Plan: Azure Infrastructure Landing Zone

**Branch**: `007-infra-azure` | **Date**: 2026-01-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-infra-azure/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deploy recall-core to Azure with Infrastructure as Code (Bicep). This includes:
- **API**: Azure Container Apps (ACA) with managed identity, Key Vault integration, and HTTPS ingress
- **Frontend**: Azure Static Web Apps (SWA) linked to ACA backend for `/api` routing
- **Database**: Azure DocumentDB (MongoDB-compatible vCore) with connection string in Key Vault
- **Storage**: Azure Storage Account (Blob for thumbnails, Queue for enrichment jobs)
- **Background Jobs**: ACA Jobs triggered by Storage Queue messages
- **Observability**: Application Insights with OpenTelemetry exporter + Log Analytics workspace
- **CI/CD**: GitHub Actions with OIDC federation for automated deployments

## Technical Context

**IaC Language**: Bicep (Azure-native, integrated with AZ CLI)  
**Primary Dependencies**: Azure Resource Manager, Azure CLI 2.60+, Bicep CLI  
**CI/CD Platform**: GitHub Actions with OIDC workload identity federation  
**Target Environments**: dev (cost-optimized), prod (reliability-focused)  
**Target Region**: West Europe (EU data residency, broad service availability)  
**Project Type**: Infrastructure-as-Code (no application source changes)  
**Performance Goals**: Infrastructure provisioning <20 minutes, API health endpoint responds within 60s of deployment  
**Constraints**: Cost-conscious dev tier, HTTPS-only ingress, Key Vault RBAC only (no access policies)  
**Scale/Scope**: Single-tenant personal application (~10k bookmarks), 2 environments (dev/prod)

### Naming Convention

Pattern: `{resource-abbrev}-recall-{env}` (e.g., `aca-recall-dev`, `kv-recall-prod`)

| Resource Type | Abbreviation | Example (dev) |
|---------------|--------------|---------------|
| Resource Group | rg | rg-recall-dev |
| Container Apps Environment | cae | cae-recall-dev |
| Container App (API) | aca | aca-recall-api-dev |
| Container Apps Job | acj | acj-recall-enrichment-dev |
| Static Web App | swa | swa-recall-dev |
| Key Vault | kv | kv-recall-dev |
| App Configuration | appcs | appcs-recall-dev |
| Storage Account | st | strecalldev (no hyphens) |
| Application Insights | appi | appi-recall-dev |
| Log Analytics Workspace | log | log-recall-dev |
| Container Registry | cr | crrecalldev |
| DocumentDB (Cosmos DB) | cosmos | cosmos-recall-dev |

### SKU Baselines

| Resource | Dev SKU | Prod SKU | Notes |
|----------|---------|----------|-------|
| Container Apps | Consumption | Consumption | Scale 0-3 dev, 1-10 prod |
| Container Apps Job | Consumption | Consumption | Event-driven, scale-to-zero |
| Static Web App | Free | Standard | Custom domains require Standard |
| Key Vault | Standard | Standard | No Premium HSM needed |
| App Configuration | Free | Standard | Free tier sufficient for dev |
| Storage Account | Standard_LRS | Standard_GRS | GRS for prod durability |
| Application Insights | Pay-per-use | Pay-per-use | Quota sampling for cost control |
| Log Analytics | Pay-per-GB | Pay-per-GB | 30-day retention dev, 90-day prod |
| DocumentDB (vCore) | Free (if eligible) or M25 | M40 | Serverless not available for vCore |
| Container Registry | Basic | Standard | Standard for geo-replication (optional) |

### Tag Strategy

All resources tagged with:
- `environment`: dev | prod
- `project`: recall-core
- `managedBy`: bicep
- `costCenter`: recall-{env}

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check (Phase 0)

| Gate | Status | Notes |
|------|--------|-------|
| Feature aligns with Product Focus (minimal scope)? | ✅ PASS | Infrastructure is required to deploy and run the application |
| Privacy requirements addressed (sanitization, no tracking)? | ⚪ N/A | Infrastructure layer; privacy enforced at application level |
| Architecture follows domain/app/infra layers? | ⚪ N/A | IaC is infrastructure-only; no application code changes |
| Testing strategy defined for each layer? | ✅ PASS | Bicep what-if validation, GitHub Actions workflow testing |
| Performance budget established (<200ms save, pagination)? | ⚪ N/A | Application-level constraint; infra supports via ACA scaling |
| Reliability patterns included (timeouts, retries)? | ✅ PASS | ACA health probes, scaling rules, queue retry policies |
| Accessibility requirements specified? | ⚪ N/A | Frontend code handles accessibility; SWA is just hosting |
| Observability hooks planned (logs, correlation IDs)? | ✅ PASS | App Insights + Log Analytics + OpenTelemetry configured |

### Post-Design Check (Phase 1)

| Gate | Status | Notes |
|------|--------|-------|
| Security baseline established? | ✅ PASS | Key Vault RBAC, managed identities, HTTPS-only, storage private |
| Cost controls documented? | ✅ PASS | Dev SKU baselines, scale-to-zero, retention limits |
| Secrets management secure? | ✅ PASS | All secrets in Key Vault; managed identity access |
| CORS/networking configured? | ✅ PASS | SWA linked backend avoids CORS; DocumentDB firewall rules |
| Deployment automation complete? | ✅ PASS | GitHub Actions for infra, API, web, enrichment |
| Runbook documentation planned? | ✅ PASS | /docs/infra/* covering deploy, rollback, secrets, debugging |

**Constitution Check Result**: PASS - All applicable gates satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/007-infra-azure/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (resource topology diagram)
├── quickstart.md        # Phase 1 output (local deployment steps)
├── contracts/           # Phase 1 output (Bicep module interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
infra/                                   # NEW: All Bicep modules
├── main.bicep                           # Entry point for full stack deployment
├── main.bicepparam                      # Parameter file template
├── parameters/
│   ├── dev.bicepparam                   # Dev environment parameters
│   └── prod.bicepparam                  # Prod environment parameters
├── modules/
│   ├── core/
│   │   ├── resource-group.bicep         # Resource group (if deploying at subscription level)
│   │   ├── log-analytics.bicep          # Log Analytics workspace
│   │   ├── app-insights.bicep           # Application Insights (workspace-based)
│   │   ├── key-vault.bicep              # Key Vault with RBAC
│   │   └── app-configuration.bicep      # App Configuration resource
│   ├── storage/
│   │   ├── storage-account.bicep        # Storage account + containers + queues
│   │   └── storage-roles.bicep          # RBAC role assignments for managed identity
│   ├── database/
│   │   └── documentdb.bicep             # Azure DocumentDB (Cosmos DB for MongoDB vCore)
│   ├── container/
│   │   ├── container-registry.bicep     # Azure Container Registry
│   │   ├── container-apps-env.bicep     # Container Apps Environment
│   │   ├── container-app-api.bicep      # API Container App
│   │   └── container-app-job.bicep      # Enrichment Job (event-driven)
│   └── web/
│       └── static-web-app.bicep         # Azure Static Web App
└── scripts/
    ├── deploy.sh                        # Manual deployment script
    └── what-if.sh                       # Preview changes script

.github/workflows/                       # CI/CD pipelines
├── infra-deploy.yml                     # Infrastructure provisioning
├── api-deploy.yml                       # API image build + ACA deployment
├── enrichment-deploy.yml                # Enrichment image build + ACA Job deployment
└── web-deploy.yml                       # SWA deployment

docs/infra/                              # NEW: Operational documentation
├── overview.md                          # Architecture diagram + endpoints
├── runbook.md                           # Deploy, rollback, rotate secrets, debug
└── cost.md                              # Cost baseline + optimization knobs
```

**Structure Decision**: Infrastructure-as-Code in `/infra` directory with modular Bicep structure. Modules organized by resource category (core, storage, database, container, web) for reusability and clear ownership. GitHub Actions workflows in `.github/workflows/` for automated deployment.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Multiple Bicep modules | Modularity for reuse and testing | Single monolithic Bicep file would be unmaintainable |
| Separate workflows per component | Independent deployment cycles | Single workflow would couple API/web/infra releases |
| App Configuration resource | Centralized non-secret config | Environment variables in ACA are harder to audit/rotate |
