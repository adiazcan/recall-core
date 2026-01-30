# Azure Infrastructure Overview

## Purpose
This document summarizes the Azure landing zone for recall-core, including the resource topology, security model, and deployment entry points.

## Architecture Summary
The deployment targets two environments (dev, prod) in West Europe and provisions:
- Azure Container Apps for the API and enrichment job
- Azure Static Web Apps for the frontend
- Azure Cosmos DB for MongoDB vCore (DocumentDB)
- Azure Storage for blobs (thumbnails) and queue messages
- Azure Key Vault + App Configuration for secrets and settings
- Application Insights + Log Analytics for observability
- Azure Container Registry for container images

## Resource Inventory
| Layer | Resource | Purpose |
|------|----------|---------|
| Core | Resource Group | Logical container for environment resources |
| Observability | Log Analytics, App Insights | Logs, metrics, traces |
| Secrets/Config | Key Vault, App Configuration | Secrets and non-secret settings |
| Data | DocumentDB (MongoDB vCore) | Application persistence |
| Storage | Storage Account | Thumbnails (Blob) + enrichment queue (Queue) |
| Compute | Container Apps Environment | Host for API and job |
| Web | Static Web App | Frontend hosting + /api routing |
| Registry | Container Registry | Image storage |

## Naming Convention
Pattern: `{resource-abbrev}-recall-{env}` (storage and registry omit hyphens as required).

## Security Model
- System-assigned managed identity for all container apps and jobs
- Key Vault uses RBAC only (no access policies)
- Storage disables public blob access and shared key auth
- HTTPS-only ingress for the API

## Environments
- **dev**: cost-optimized SKUs (Free/Basic/Consumption where applicable)
- **prod**: reliability-focused SKUs (Standard/GRS where applicable)

## Deployment Entry Points
- Bicep entrypoint: infra/main.bicep
- Parameters: infra/parameters/dev.bicepparam, infra/parameters/prod.bicepparam
- Manual deployment: specs/007-infra-azure/quickstart.md
- CI/CD workflows: .github/workflows/infra-deploy.yml

## Endpoints
- API: Container App HTTPS endpoint
- Frontend: Static Web App hostname
- Health: `/health` on API

## Related Documentation
- specs/007-infra-azure/quickstart.md
- docs/infra/runbook.md
- docs/infra/cost.md
- docs/infra/github-oidc-setup.md
- docs/infra/swa-cors-fallback.md
