# GitHub Actions Workflow Contracts

**Feature**: 007-azure-infra  
**Date**: 2026-01-28  
**Status**: Complete

## Overview

This document defines the GitHub Actions workflow interfaces, inputs, outputs, and secrets required for automated infrastructure provisioning and application deployment.

---

## Workflow: infra-deploy.yml

**Purpose**: Provision or update Azure infrastructure using Terraform.

**Trigger**: `workflow_dispatch` (manual)

### Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `environment` | choice | yes | - | Target environment (dev/prod) |
| `action` | choice | yes | plan | Terraform action (plan/apply/destroy) |

### Secrets (from GitHub Environment)

| Secret | Required | Description |
|--------|----------|-------------|
| `AZURE_CLIENT_ID` | yes | Azure AD app registration client ID (OIDC) |
| `AZURE_TENANT_ID` | yes | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | yes | Azure subscription ID |

### Environment Protection

| Environment | Rules |
|-------------|-------|
| `dev` | No protection (auto-approve) |
| `prod` | Required reviewers (1+), wait timer (optional) |

### Workflow Definition

```yaml
name: Deploy Infrastructure

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - dev
          - prod
      action:
        description: 'Terraform action'
        required: true
        type: choice
        default: plan
        options:
          - plan
          - apply
          - destroy

permissions:
  id-token: write
  contents: read

jobs:
  terraform:
    name: Terraform ${{ inputs.action }}
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    defaults:
      run:
        working-directory: infra

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.7.x

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Terraform Init
        run: |
          terraform init \
            -backend-config="key=${{ inputs.environment }}.tfstate"

      - name: Terraform Validate
        run: terraform validate

      - name: Terraform Plan
        if: inputs.action == 'plan' || inputs.action == 'apply'
        run: |
          terraform plan \
            -var-file="environments/${{ inputs.environment }}.tfvars" \
            -out=tfplan

      - name: Terraform Apply
        if: inputs.action == 'apply'
        run: terraform apply -auto-approve tfplan

      - name: Terraform Destroy
        if: inputs.action == 'destroy'
        run: |
          terraform destroy \
            -var-file="environments/${{ inputs.environment }}.tfvars" \
            -auto-approve

      - name: Export Outputs
        if: inputs.action == 'apply'
        id: outputs
        run: |
          echo "api_url=$(terraform output -raw api_container_app_url)" >> $GITHUB_OUTPUT
          echo "web_url=$(terraform output -raw static_web_app_url)" >> $GITHUB_OUTPUT
```

---

## Workflow: api-deploy.yml

**Purpose**: Build API container image and deploy to Azure Container Apps.

**Trigger**: Push to `main` with changes in `src/Recall.Core.Api/**`

### Inputs (for workflow_dispatch)

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `environment` | choice | yes | dev | Target environment |

### Secrets (from GitHub Environment)

| Secret | Required | Description |
|--------|----------|-------------|
| `AZURE_CLIENT_ID` | yes | Azure AD app client ID (OIDC) |
| `AZURE_TENANT_ID` | yes | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | yes | Azure subscription ID |
| `ACR_LOGIN_SERVER` | yes | ACR login server (recallacr.azurecr.io) |

### Workflow Definition

```yaml
name: Deploy API

on:
  push:
    branches: [main]
    paths:
      - 'src/Recall.Core.Api/**'
      - 'src/Recall.Core.ServiceDefaults/**'
      - '.github/workflows/api-deploy.yml'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        default: dev
        options:
          - dev
          - prod

permissions:
  id-token: write
  contents: read
  packages: write

env:
  IMAGE_NAME: recall-api
  DOCKERFILE: src/Recall.Core.Api/Dockerfile

jobs:
  build-push:
    name: Build and Push Image
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
      image_digest: ${{ steps.build.outputs.digest }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Login to ACR
        run: az acr login --name recallacr

      - name: Docker Meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.ACR_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=${{ inputs.environment || 'dev' }}-
            type=raw,value=${{ inputs.environment || 'dev' }}-latest

      - name: Build and Push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: src
          file: ${{ env.DOCKERFILE }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    name: Deploy to ACA
    needs: build-push
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'dev' }}

    steps:
      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy to Container App
        run: |
          az containerapp update \
            --name recall-api-${{ inputs.environment || 'dev' }} \
            --resource-group recall-${{ inputs.environment || 'dev' }}-rg \
            --image ${{ needs.build-push.outputs.image_tag }}
```

---

## Workflow: enrichment-deploy.yml

**Purpose**: Build Enrichment container image and update ACA Job.

**Trigger**: Push to `main` with changes in `src/Recall.Core.Enrichment/**`

### Workflow Definition

```yaml
name: Deploy Enrichment

on:
  push:
    branches: [main]
    paths:
      - 'src/Recall.Core.Enrichment/**'
      - 'src/Recall.Core.ServiceDefaults/**'
      - '.github/workflows/enrichment-deploy.yml'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        default: dev
        options:
          - dev
          - prod

permissions:
  id-token: write
  contents: read

env:
  IMAGE_NAME: recall-enrichment
  DOCKERFILE: src/Recall.Core.Enrichment/Dockerfile

jobs:
  build-push:
    name: Build and Push Image
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ secrets.ACR_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.version }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Login to ACR
        run: az acr login --name recallacr

      - name: Docker Meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.ACR_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=${{ inputs.environment || 'dev' }}-
            type=raw,value=${{ inputs.environment || 'dev' }}-latest

      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: src
          file: ${{ env.DOCKERFILE }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}

  deploy:
    name: Update ACA Job
    needs: build-push
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'dev' }}

    steps:
      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Update Job Image
        run: |
          az containerapp job update \
            --name recall-job-${{ inputs.environment || 'dev' }} \
            --resource-group recall-${{ inputs.environment || 'dev' }}-rg \
            --image ${{ needs.build-push.outputs.image_tag }}
```

---

## Workflow: web-deploy.yml

**Purpose**: Build and deploy React frontend to Static Web App.

**Trigger**: Push to `main` with changes in `src/web/**`

### Secrets Required

| Secret | Required | Description |
|--------|----------|-------------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` | yes (dev) | SWA deployment token for dev |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` | yes (prod) | SWA deployment token for prod |

### Workflow Definition

```yaml
name: Deploy Web

on:
  push:
    branches: [main]
    paths:
      - 'src/web/**'
      - '.github/workflows/web-deploy.yml'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        default: dev
        options:
          - dev
          - prod

jobs:
  build-deploy:
    name: Build and Deploy
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'dev' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: 'src/web/package-lock.json'

      - name: Install Dependencies
        working-directory: src/web
        run: npm ci

      - name: Build
        working-directory: src/web
        run: npm run build
        env:
          # API calls via SWA linked backend - no base URL needed
          VITE_API_BASE_URL: ''

      - name: Deploy to SWA
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ inputs.environment == 'prod' && secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_PROD || secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_DEV }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: src/web
          output_location: dist
          skip_app_build: true
```

---

## GitHub Secrets Configuration

### Repository-Level Secrets

| Secret | Value Source | Description |
|--------|--------------|-------------|
| `ACR_LOGIN_SERVER` | Terraform output | recallacr.azurecr.io |

### Environment-Level Secrets (dev)

| Secret | Value Source | Description |
|--------|--------------|-------------|
| `AZURE_CLIENT_ID` | Azure AD app | OIDC federation client ID |
| `AZURE_TENANT_ID` | Azure AD | Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure Portal | Subscription ID |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` | Terraform output | SWA deployment token |

### Environment-Level Secrets (prod)

| Secret | Value Source | Description |
|--------|--------------|-------------|
| `AZURE_CLIENT_ID` | Azure AD app | OIDC federation client ID |
| `AZURE_TENANT_ID` | Azure AD | Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure Portal | Subscription ID |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` | Terraform output | SWA deployment token |

---

## OIDC Federation Setup

To enable passwordless authentication from GitHub Actions to Azure:

1. **Create Azure AD App Registration**:
   ```bash
   az ad app create --display-name "recall-core-github-actions"
   ```

2. **Add Federated Credential** (per environment):
   ```bash
   az ad app federated-credential create \
     --id <app-object-id> \
     --parameters '{
       "name": "github-actions-dev",
       "issuer": "https://token.actions.githubusercontent.com",
       "subject": "repo:YOUR_ORG/recall-core:environment:dev",
       "audiences": ["api://AzureADTokenExchange"]
     }'
   ```

3. **Assign Roles** to Service Principal:
   ```bash
   # Contributor scoped to a specific resource group (least privilege)
   az role assignment create \
     --assignee <app-id> \
     --role Contributor \
     --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>
   ```
