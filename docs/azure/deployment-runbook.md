# Azure Deployment Runbook

**Feature**: 007-azure-infra  
**Scope**: Bootstrap prerequisites and Terraform deployment workflow

## Overview

This runbook describes the one-time bootstrap steps required before running Terraform, plus the standard deploy workflow for dev/prod environments.

## Prerequisites

- Azure CLI 2.50+
- Terraform 1.7+
- Docker 24+
- Logged in to Azure: `az login`
- Subscription selected: `az account set --subscription "<name or id>"`

## Phase 2 Bootstrap (One-time)

### 1) Terraform State Storage

Creates the storage account and container used by the Terraform backend.

**Script**: [infra/scripts/bootstrap-state.sh](../../infra/scripts/bootstrap-state.sh)

```bash
export LOCATION="swedencentral"
export STATE_RG="recall-tfstate-rg"
export STATE_SA="recalltfstate"
export STATE_CONTAINER="tfstate"

./infra/scripts/bootstrap-state.sh
```

### 2) Shared Azure Container Registry (ACR)

Creates a shared ACR used by both dev/prod environments.

**Script**: [infra/scripts/bootstrap-acr.sh](../../infra/scripts/bootstrap-acr.sh)

```bash
export LOCATION="swedencentral"
export ACR_RG="recall-shared-rg"
export ACR_NAME="recallacr"
export ACR_SKU="Basic"

./infra/scripts/bootstrap-acr.sh
```

### 3) GitHub Actions OIDC Federation

Configures federated identity credentials for GitHub Actions and assigns roles.

**Script**: [infra/scripts/bootstrap-oidc.sh](../../infra/scripts/bootstrap-oidc.sh)

```bash
export GITHUB_REPO="YOUR_ORG/recall-core"
export APP_NAME="recall-core-github-actions"
export RESOURCE_GROUP_SCOPE="/subscriptions/<subscription-id>/resourceGroups/recall-dev-rg"

./infra/scripts/bootstrap-oidc.sh
```

**Outputs to save as GitHub secrets**:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

## Terraform Deployment

### Initialize and Plan (Dev)

```bash
cd infra
terraform init -backend-config="key=dev.tfstate"
terraform plan -var-file="environments/dev.tfvars" -out=tfplan
```

### Apply (Dev)

```bash
terraform apply tfplan
```

### Destroy (Dev)

```bash
terraform destroy -var-file="environments/dev.tfvars"
```

## GitHub Actions Environments

Create two environments in GitHub: `dev` and `prod`.

- `dev`: No protection rules (auto-approve).
- `prod`: Require at least 1 reviewer; optional wait timer.

## GitHub Secrets Configuration

### Repository Secrets

| Secret | Description | Source |
| --- | --- | --- |
| `ACR_LOGIN_SERVER` | ACR login server (recallacr.azurecr.io) | Terraform output or ACR resource |

### Environment Secrets (dev)

| Secret | Description | Source |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | Azure AD app client ID (OIDC) | `bootstrap-oidc.sh` output |
| `AZURE_TENANT_ID` | Azure AD tenant ID | `az account show` |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | `az account show` |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` | SWA deployment token | `terraform output -raw static_web_app_api_key` |

### Environment Secrets (prod)

| Secret | Description | Source |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | Azure AD app client ID (OIDC) | `bootstrap-oidc.sh` output |
| `AZURE_TENANT_ID` | Azure AD tenant ID | `az account show` |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | `az account show` |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` | SWA deployment token | `terraform output -raw static_web_app_api_key` |

## Workflow Triggers

- **Infrastructure**: `Deploy Infrastructure` uses manual trigger with inputs `environment` and `action` (plan/apply/destroy).
- **API**: `Deploy API` runs on push to `main` for `src/Recall.Core.Api/**` and supports manual runs.
- **Enrichment**: `Deploy Enrichment` runs on push to `main` for `src/Recall.Core.Enrichment/**` and supports manual runs.
- **Web**: `Deploy Web` runs on push to `main` for `src/web/**` and supports manual runs.

## Resource Naming and Topology

### Naming Convention

Pattern: `{project}-{resource}-{env}` (lowercase, short, deterministic)

| Resource Type | Pattern | Example (dev) | Example (prod) |
| --- | --- | --- | --- |
| Resource Group | `recall-{env}-rg` | `recall-dev-rg` | `recall-prod-rg` |
| Container Apps Env | `recall-{env}-cae` | `recall-dev-cae` | `recall-prod-cae` |
| Container App (API) | `recall-api-{env}` | `recall-api-dev` | `recall-api-prod` |
| Container App (Enrichment) | `recall-enrichment-{env}` | `recall-enrichment-dev` | `recall-enrichment-prod` |
| Static Web App | `recall-web-{env}` | `recall-web-dev` | `recall-web-prod` |
| Storage Account | `recall{env}st` | `recalldevst` | `recallprodst` |
| Key Vault | `recall-{env}-kv` | `recall-dev-kv` | `recall-prod-kv` |
| DocumentDB | `recall-{env}-docdb` | `recall-dev-docdb` | `recall-prod-docdb` |
| App Insights | `recall-{env}-ai` | `recall-dev-ai` | `recall-prod-ai` |
| Log Analytics | `recall-{env}-law` | `recall-dev-law` | `recall-prod-law` |
| ACR (shared) | `recallacr` | `recallacr` | `recallacr` |

### Topology Summary

Each environment uses a dedicated resource group and shared ACR. The environment resource group contains:
- Log Analytics + Application Insights
- Key Vault
- Storage account (blob + queue)
- DocumentDB (MongoDB vCore)
- Container Apps environment hosting API + Enrichment apps
- Static Web App linked to the API container app

## Post-Deploy Verification

1. **API health**
	- Get the API URL: `terraform output -raw api_container_app_url`
	- Check: `curl -s "$API_URL/health"`
2. **Web app**
	- Get the web URL: `terraform output -raw static_web_app_url`
	- Open in browser and verify the shell loads.
3. **App Insights**
	- Make a request and verify traces appear within 5 minutes.

## Notes

- Use `dev` for validation and testing; promote to `prod` after approval.
- Terraform outputs are defined in [specs/007-azure-infra/contracts/terraform-outputs.md](../../specs/007-azure-infra/contracts/terraform-outputs.md).
- Workflow contracts are defined in [specs/007-azure-infra/contracts/workflows.md](../../specs/007-azure-infra/contracts/workflows.md).
