````markdown
# GitHub Actions Workflows: Azure Infrastructure

**Feature Branch**: `007-infra-azure`  
**Created**: 2026-01-30

---

## Overview

This document defines the GitHub Actions workflow contracts for deploying recall-core infrastructure and applications to Azure.

---

## Workflow: Infrastructure Deploy

### .github/workflows/infra-deploy.yml

**Purpose**: Deploy or update Azure infrastructure using Bicep.

**Trigger**: Manual (`workflow_dispatch`)

**Inputs**:
| Input | Type | Required | Options | Description |
|-------|------|----------|---------|-------------|
| environment | choice | Yes | dev, prod | Target environment |

**Environment Secrets/Variables**:
| Name | Type | Description |
|------|------|-------------|
| AZURE_CLIENT_ID | Variable | App registration client ID for OIDC |
| AZURE_TENANT_ID | Variable | Entra ID tenant ID |
| AZURE_SUBSCRIPTION_ID | Variable | Azure subscription ID |
| DOCUMENTDB_ADMIN_PASSWORD | Secret | DocumentDB administrator password |

**Steps**:
1. Checkout repository
2. Azure Login (OIDC)
3. Deploy Bicep (subscription scope)

**Outputs**:
- Deployment name
- Resource group name
- API endpoint URL
- SWA endpoint URL

---

## Workflow: API Deploy

### .github/workflows/api-deploy.yml

**Purpose**: Build API container image, push to ACR, update Container App.

**Trigger**: Manual (`workflow_dispatch`)

**Inputs**:
| Input | Type | Required | Options | Description |
|-------|------|----------|---------|-------------|
| environment | choice | Yes | dev, prod | Target environment |

**Environment Secrets/Variables**:
| Name | Type | Description |
|------|------|-------------|
| AZURE_CLIENT_ID | Variable | App registration client ID for OIDC |
| AZURE_TENANT_ID | Variable | Entra ID tenant ID |
| AZURE_SUBSCRIPTION_ID | Variable | Azure subscription ID |

**Steps**:
1. Checkout repository
2. Azure Login (OIDC)
3. Login to ACR
4. Set up Docker Buildx
5. Build and push image (tag: `${{ github.sha }}`)
6. Update Container App revision
7. Wait for deployment health

**Image Naming**:
- Registry: `crrecall{env}.azurecr.io`
- Repository: `recall-api`
- Tag: Git SHA (`${{ github.sha }}`)

---

## Workflow: Enrichment Deploy

### .github/workflows/enrichment-deploy.yml

**Purpose**: Build enrichment container image, push to ACR, update ACA Job.

**Trigger**: Manual (`workflow_dispatch`)

**Inputs**:
| Input | Type | Required | Options | Description |
|-------|------|----------|---------|-------------|
| environment | choice | Yes | dev, prod | Target environment |

**Environment Secrets/Variables**:
| Name | Type | Description |
|------|------|-------------|
| AZURE_CLIENT_ID | Variable | App registration client ID for OIDC |
| AZURE_TENANT_ID | Variable | Entra ID tenant ID |
| AZURE_SUBSCRIPTION_ID | Variable | Azure subscription ID |

**Steps**:
1. Checkout repository
2. Azure Login (OIDC)
3. Login to ACR
4. Set up Docker Buildx
5. Build and push image with Playwright browsers
6. Update ACA Job container image

**Image Naming**:
- Registry: `crrecall{env}.azurecr.io`
- Repository: `recall-enrichment`
- Tag: Git SHA (`${{ github.sha }}`)

**Special Requirements**:
- Playwright browsers must be installed during image build
- Image size will be larger (~1GB+) due to Chromium

---

## Workflow: Web Deploy

### .github/workflows/web-deploy.yml

**Purpose**: Deploy React frontend to Azure Static Web Apps.

**Trigger**: Manual (`workflow_dispatch`)

**Inputs**:
| Input | Type | Required | Options | Description |
|-------|------|----------|---------|-------------|
| environment | choice | Yes | dev, prod | Target environment |

**Environment Secrets/Variables**:
| Name | Type | Description |
|------|------|-------------|
| AZURE_STATIC_WEB_APPS_API_TOKEN_DEV | Secret | SWA deployment token (dev) |
| AZURE_STATIC_WEB_APPS_API_TOKEN_PROD | Secret | SWA deployment token (prod) |
| VITE_API_BASE_URL | Variable | API base URL for frontend config |

**Steps**:
1. Checkout repository
2. Setup Node.js
3. Setup pnpm
4. Install dependencies
5. Build React app
6. Deploy to SWA

**Build Configuration**:
- App location: `src/web`
- Output location: `dist`
- Build command: `pnpm run build`

---

## Workflow: CI Pipeline

### .github/workflows/ci.yml

**Purpose**: Continuous integration - build, test, lint on PRs.

**Trigger**: Pull request to `main` branch

**Jobs**:
1. **test-api**
   - Setup .NET 10
   - Restore, build, test
   - Report coverage

2. **test-enrichment**
   - Setup .NET 10
   - Restore, build, test
   - Report coverage

2. **test-web**
   - Setup Node.js + pnpm
   - Install, lint, test
   - Report coverage

3. **build-containers** (on merge to main)
   - Build API image (no push)
   - Build Enrichment image (no push)
   - Validates Dockerfiles work

---

## Environment Configuration

### GitHub Environments

Create two environments in repository settings:

**dev**:
| Type | Name | Value |
|------|------|-------|
| Variable | AZURE_CLIENT_ID | `<dev-app-client-id>` |
| Variable | AZURE_TENANT_ID | `<tenant-id>` |
| Variable | AZURE_SUBSCRIPTION_ID | `<subscription-id>` |
| Secret | DOCUMENTDB_ADMIN_PASSWORD | `<dev-password>` |
| Secret | AZURE_STATIC_WEB_APPS_API_TOKEN_DEV | `<swa-token>` |

**prod**:
| Type | Name | Value |
|------|------|-------|
| Variable | AZURE_CLIENT_ID | `<prod-app-client-id>` |
| Variable | AZURE_TENANT_ID | `<tenant-id>` |
| Variable | AZURE_SUBSCRIPTION_ID | `<subscription-id>` |
| Secret | DOCUMENTDB_ADMIN_PASSWORD | `<prod-password>` |
| Secret | AZURE_STATIC_WEB_APPS_API_TOKEN_PROD | `<swa-token>` |
| Protection Rules | Required reviewers | `1+` |

---

## OIDC Federation Setup

### App Registration Requirements

For each environment, create an app registration with federated credentials:

**Federated Credentials**:
```json
{
  "name": "github-{env}",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:adiazcan/recall-core:environment:{env}",
  "audiences": ["api://AzureADTokenExchange"]
}
```

**Service Principal Roles**:
- `Contributor` on resource group
- `AcrPush` on container registry
- `Key Vault Secrets Officer` (for initial secret seeding)

---

## Workflow Templates

### Reusable Workflow: Azure Login

```yaml
# .github/workflows/reusable-azure-login.yml
name: Azure Login

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string

jobs:
  login:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

### Reusable Workflow: Docker Build and Push

```yaml
# .github/workflows/reusable-docker-build.yml
name: Docker Build and Push

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      dockerfile:
        required: true
        type: string
      context:
        required: true
        type: string
      image-name:
        required: true
        type: string

jobs:
  build:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      
      - name: Login to ACR
        run: az acr login --name crrecall${{ inputs.environment }}
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: ${{ inputs.context }}
          file: ${{ inputs.dockerfile }}
          push: true
          tags: |
            crrecall${{ inputs.environment }}.azurecr.io/${{ inputs.image-name }}:${{ github.sha }}
            crrecall${{ inputs.environment }}.azurecr.io/${{ inputs.image-name }}:latest
          cache-from: type=registry,ref=crrecall${{ inputs.environment }}.azurecr.io/${{ inputs.image-name }}:buildcache
          cache-to: type=registry,ref=crrecall${{ inputs.environment }}.azurecr.io/${{ inputs.image-name }}:buildcache,mode=max
```

````