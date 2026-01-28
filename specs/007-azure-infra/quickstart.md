# Quickstart: Azure Infrastructure Deployment

**Feature**: 007-azure-infra  
**Date**: 2026-01-28  
**Status**: Complete

## Overview

This guide walks through deploying recall-core to Azure using the Terraform infrastructure. Total time: ~30 minutes for first deployment.

---

## Prerequisites

### Tools

| Tool | Version | Installation |
|------|---------|--------------|
| Azure CLI | 2.50+ | `brew install azure-cli` or [install guide](https://docs.microsoft.com/cli/azure/install-azure-cli) |
| Terraform | 1.7+ | `brew install terraform` or [install guide](https://developer.hashicorp.com/terraform/install) |
| Docker | 24+ | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

### Azure Requirements

- Azure subscription with Contributor access
- Ability to create Azure AD app registrations (for OIDC)
- Permissions to assign RBAC roles

### Verify Prerequisites

```bash
# Check versions
az version
terraform version
docker version

# Login to Azure
az login

# Set subscription (if you have multiple)
az account set --subscription "Your Subscription Name"
az account show
```

---

## Step 1: Bootstrap Terraform State Storage (One-time)

Before deploying infrastructure, create the storage account for Terraform state:

```bash
# Set variables
LOCATION="swedencentral"
STATE_RG="recall-tfstate-rg"
STATE_SA="recalltfstate"
STATE_CONTAINER="tfstate"

# Create resource group
az group create --name $STATE_RG --location $LOCATION

# Create storage account
az storage account create \
  --name $STATE_SA \
  --resource-group $STATE_RG \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2

# Create container
az storage container create \
  --name $STATE_CONTAINER \
  --account-name $STATE_SA

# Enable versioning for state protection
az storage account blob-service-properties update \
  --account-name $STATE_SA \
  --enable-versioning true

echo "✅ Terraform state storage created"
```

---

## Step 2: Create Azure Container Registry (One-time)

```bash
# Create shared ACR
az group create --name recall-shared-rg --location swedencentral

az acr create \
  --name recallacr \
  --resource-group recall-shared-rg \
  --sku Basic \
  --admin-enabled false

echo "✅ ACR created: recallacr.azurecr.io"
```

---

## Step 3: Set Up OIDC Authentication (One-time)

For GitHub Actions to deploy to Azure without secrets:

```bash
# Create app registration
APP_ID=$(az ad app create --display-name "recall-core-github-actions" --query appId -o tsv)
echo "App ID: $APP_ID"

# Create service principal
az ad sp create --id $APP_ID

# Get object ID for federated credentials
OBJECT_ID=$(az ad app show --id $APP_ID --query id -o tsv)

# Add federated credential for dev environment
az ad app federated-credential create \
  --id $OBJECT_ID \
  --parameters '{
    "name": "github-actions-dev",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_ORG/recall-core:environment:dev",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Add federated credential for prod environment
az ad app federated-credential create \
  --id $OBJECT_ID \
  --parameters '{
    "name": "github-actions-prod",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_ORG/recall-core:environment:prod",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Assign Contributor role on subscription
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az role assignment create \
  --assignee $APP_ID \
  --role Contributor \
  --scope /subscriptions/$SUBSCRIPTION_ID

# Also assign on state storage
az role assignment create \
  --assignee $APP_ID \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/recall-tfstate-rg

echo "✅ OIDC configured"
echo ""
echo "Add these secrets to GitHub:"
echo "  AZURE_CLIENT_ID: $APP_ID"
echo "  AZURE_TENANT_ID: $(az account show --query tenantId -o tsv)"
echo "  AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
```

---

## Step 4: Deploy Infrastructure (Dev)

### Option A: Local Terraform (Manual)

```bash
cd infra

# Initialize Terraform
terraform init -backend-config="key=dev.tfstate"

# Plan changes
terraform plan -var-file="environments/dev.tfvars" -out=tfplan

# Review the plan, then apply
terraform apply tfplan

# Get outputs
terraform output
```

### Option B: GitHub Actions (Recommended)

1. Go to **Actions** → **Deploy Infrastructure**
2. Click **Run workflow**
3. Select:
   - Environment: `dev`
   - Action: `apply`
4. Wait for completion (~15-20 minutes)

---

## Step 5: Build and Push Container Images

### Build API Image

```bash
# Login to ACR
az acr login --name recallacr

# Build and push API
docker build -t recallacr.azurecr.io/recall-api:dev-local -f src/Recall.Core.Api/Dockerfile src/
docker push recallacr.azurecr.io/recall-api:dev-local
```

### Build Enrichment Image

```bash
docker build -t recallacr.azurecr.io/recall-enrichment:dev-local -f src/Recall.Core.Enrichment/Dockerfile src/
docker push recallacr.azurecr.io/recall-enrichment:dev-local
```

---

## Step 6: Deploy Applications

### Deploy API to Container Apps

```bash
az containerapp update \
  --name recall-api-dev \
  --resource-group recall-dev-rg \
  --image recallacr.azurecr.io/recall-api:dev-local
```

### Deploy Frontend to Static Web App

```bash
# Build frontend
cd src/web
npm ci
npm run build

# Get SWA deployment token
SWA_TOKEN=$(cd ../../infra && terraform output -raw static_web_app_api_key)

# Deploy using SWA CLI
npx @azure/static-web-apps-cli deploy dist \
  --deployment-token $SWA_TOKEN
```

---

## Step 7: Verify Deployment

### Check API Health

```bash
# Get API URL
API_URL=$(cd infra && terraform output -raw api_container_app_url)

# Health check
curl -s "$API_URL/health" | jq .
# Expected: { "status": "ok" }
```

### Check Frontend

```bash
# Get SWA URL
WEB_URL=$(cd infra && terraform output -raw static_web_app_url)

# Open in browser
echo "Frontend URL: $WEB_URL"
open $WEB_URL  # macOS
```

### Check Observability

1. Go to Azure Portal → `recall-dev-rg` → `recall-dev-ai` (Application Insights)
2. Navigate to **Live Metrics** to see real-time requests
3. Check **Transaction Search** for traces

---

## Quick Commands Reference

| Task | Command |
|------|---------|
| Deploy infra (dev) | `cd infra && terraform apply -var-file="environments/dev.tfvars"` |
| Deploy infra (prod) | `cd infra && terraform apply -var-file="environments/prod.tfvars"` |
| Get API URL | `terraform output -raw api_container_app_url` |
| Get Web URL | `terraform output -raw static_web_app_url` |
| View API logs | `az containerapp logs show -n recall-api-dev -g recall-dev-rg --follow` |
| Scale API | `az containerapp update -n recall-api-dev -g recall-dev-rg --min-replicas 1 --max-replicas 5` |
| Destroy infra | `terraform destroy -var-file="environments/dev.tfvars"` |

---

## Troubleshooting

### Terraform Init Fails

```
Error: Failed to get existing workspaces: storage: service returned error
```

**Fix**: Ensure you're logged in to Azure and have access to the state storage:
```bash
az login
az account set --subscription "Your Subscription"
```

### Container App Fails to Start

```bash
# Check logs
az containerapp logs show -n recall-api-dev -g recall-dev-rg --tail 100

# Check revision status
az containerapp revision list -n recall-api-dev -g recall-dev-rg -o table
```

### DocumentDB Connection Fails

```bash
# Verify Key Vault secret exists
az keyvault secret show \
  --vault-name recall-dev-kv \
  --name documentdb-connection-string

# Check if managed identity has access
az role assignment list \
  --assignee $(terraform output -raw api_identity_principal_id) \
  --scope $(terraform output key_vault_id) \
  -o table
```

### SWA Deployment Fails

```bash
# Verify deployment token
cd infra && terraform output -raw static_web_app_api_key

# Manual deploy with verbose logging
npx @azure/static-web-apps-cli deploy dist \
  --deployment-token $SWA_TOKEN \
  --verbose
```

---

## Cost Estimates

| Resource | Dev (~monthly) | Prod (~monthly) |
|----------|----------------|-----------------|
| DocumentDB (M25 vCore tier) | ~$50 | ~$50 |
| ACA (Consumption, low traffic) | ~$5-10 | ~$10-20 |
| SWA (Standard) | ~$9 | ~$9 |
| Storage (minimal) | ~$1 | ~$1 |
| App Insights (1GB/day) | ~$2-5 | ~$2-5 |
| Key Vault | ~$0.03/secret | ~$0.03/secret |
| **Total (estimated)** | **~$70-80** | **~$75-90** |

*Note: Actual costs depend on usage. Dev with scale-to-zero can be significantly lower during inactive periods.*

---

## Next Steps

1. **Configure Entra External ID** - Set up authentication (see spec 004-entra-external-auth)
2. **Set up alerts** - Configure Azure Monitor alerts for errors/latency
3. **Custom domain** - Add custom domains to SWA and/or ACA
4. **Production checklist** - Review security settings before prod deployment
