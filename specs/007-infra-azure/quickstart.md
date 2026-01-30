````markdown
# Quickstart: Azure Infrastructure Deployment

**Feature Branch**: `007-infra-azure`  
**Created**: 2026-01-30

---

## Prerequisites

### Tools Required

- **Azure CLI** 2.60+ with Bicep CLI (`az bicep version` ≥ 0.25)
- **GitHub CLI** (`gh`) for repository configuration (optional)
- **Docker** for building container images locally
- **.NET 10 SDK** for building API
- **Node.js 20+** and **pnpm** for building frontend

### Azure Requirements

- Active Azure subscription
- Contributor role on subscription (or at minimum: Resource Group + Resource creation permissions)
- Entra ID permissions to create app registrations (for GitHub OIDC)

### Install Prerequisites (macOS/Linux)

```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Verify Bicep
az bicep version
az bicep upgrade  # if needed

# GitHub CLI (optional)
brew install gh
gh auth login
```

---

## First-Time Setup

### 1. Create GitHub OIDC App Registration

Create an app registration for GitHub Actions to authenticate to Azure:

```bash
# Set variables
REPO_OWNER="adiazcan"
REPO_NAME="recall-core"
APP_NAME="recall-github-actions"

# Create app registration
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
echo "App ID: $APP_ID"

# Create service principal
az ad sp create --id $APP_ID

# Get subscription and tenant IDs
SUB_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Subscription ID: $SUB_ID"
echo "Tenant ID: $TENANT_ID"

# Create federated credential for dev environment
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-dev",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:'"$REPO_OWNER/$REPO_NAME"':environment:dev",
  "audiences": ["api://AzureADTokenExchange"]
}'

# Create federated credential for prod environment
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-prod",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:'"$REPO_OWNER/$REPO_NAME"':environment:prod",
  "audiences": ["api://AzureADTokenExchange"]
}'

# Assign Contributor role at subscription level (or scope to RG after creation)
az role assignment create \
  --assignee $APP_ID \
  --role "Contributor" \
  --scope "/subscriptions/$SUB_ID"

echo "Save these values for GitHub repository configuration:"
echo "AZURE_CLIENT_ID: $APP_ID"
echo "AZURE_TENANT_ID: $TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID: $SUB_ID"
```

### 2. Configure GitHub Repository

Configure repository variables once (single subscription), then set environment-specific secrets:

```bash
# Using GitHub CLI
# Repository variables (shared across dev/prod)
gh variable set AZURE_CLIENT_ID --body "$APP_ID"
gh variable set AZURE_TENANT_ID --body "$TENANT_ID"
gh variable set AZURE_SUBSCRIPTION_ID --body "$SUB_ID"

# Environment secrets
gh secret set DOCUMENTDB_ADMIN_PASSWORD --env dev
gh secret set DOCUMENTDB_ADMIN_PASSWORD --env prod
```

Or configure via GitHub UI:
1. Go to repository Settings → Secrets and variables → Actions
2. Add repository variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
3. Go to repository Settings → Environments
4. Create `dev` and `prod` environments
5. Add environment secrets: `DOCUMENTDB_ADMIN_PASSWORD` for each environment

---

## Deploy Infrastructure (Dev)

### Option 1: Manual Deployment (CLI)

```bash
cd /home/adiazcan/github/recall-core

# Generate a secure password for DocumentDB
DOCDB_PASSWORD=$(openssl rand -base64 24)
echo "DocumentDB Password: $DOCDB_PASSWORD"
# IMPORTANT: Save this password securely!

# Preview changes
az deployment sub what-if \
  --location westeurope \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters documentDbAdminPassword="$DOCDB_PASSWORD"

# Deploy
az deployment sub create \
  --location westeurope \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters documentDbAdminPassword="$DOCDB_PASSWORD" \
  --name recall-dev-$(date +%Y%m%d%H%M%S)
```

Expected output:
```
Deployment is in progress...
✓ rg-recall-dev (Resource Group)
✓ log-recall-dev (Log Analytics)
✓ appi-recall-dev (App Insights)
✓ kv-recall-dev (Key Vault)
✓ appcs-recall-dev (App Configuration)
✓ crrecalldev (Container Registry)
✓ strecalldev (Storage Account)
✓ cosmos-recall-dev (DocumentDB)
✓ cae-recall-dev (Container Apps Environment)
✓ aca-recall-api-dev (Container App)
✓ acj-recall-enrichment-dev (Container Apps Job)
✓ swa-recall-dev (Static Web App)

Deployment completed successfully.
```

### Option 2: GitHub Actions Deployment

1. Go to Actions tab in repository
2. Select "Deploy Infrastructure" workflow
3. Click "Run workflow"
4. Select `dev` environment
5. Confirm and monitor deployment

---

## Deploy API

### Build and Push Container Image

```bash
cd /home/adiazcan/github/recall-core

# Login to ACR
az acr login --name crrecalldev

# Build and push API image
docker build -t crrecalldev.azurecr.io/recall-api:latest \
  -f src/Recall.Core.Api/Dockerfile \
  src/

docker push crrecalldev.azurecr.io/recall-api:latest

# Update Container App
az containerapp update \
  --name aca-recall-api-dev \
  --resource-group rg-recall-dev \
  --image crrecalldev.azurecr.io/recall-api:latest
```

### Verify API Health

```bash
# Get API endpoint
API_URL=$(az containerapp show \
  --name aca-recall-api-dev \
  --resource-group rg-recall-dev \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "API URL: https://$API_URL"

# Check health
curl -s "https://$API_URL/health"
# Expected: {"status":"ok"}
```

---

## Deploy Enrichment Job

### Build and Push Container Image

```bash
cd /home/adiazcan/github/recall-core

# Build enrichment image (includes Playwright)
docker build -t crrecalldev.azurecr.io/recall-enrichment:latest \
  -f src/Recall.Core.Enrichment/Dockerfile \
  src/

docker push crrecalldev.azurecr.io/recall-enrichment:latest

# Update ACA Job
az containerapp job update \
  --name acj-recall-enrichment-dev \
  --resource-group rg-recall-dev \
  --image crrecalldev.azurecr.io/recall-enrichment:latest
```

### Test Queue Trigger

```bash
# Get storage account connection string
STORAGE_CONN=$(az storage account show-connection-string \
  --name strecalldev \
  --resource-group rg-recall-dev \
  --query connectionString -o tsv)

# Send test message to queue
az storage message put \
  --queue-name enrichment-queue \
  --content '{"itemId":"test123","userId":"user1","url":"https://example.com"}' \
  --connection-string "$STORAGE_CONN"

# Check job executions
az containerapp job execution list \
  --name acj-recall-enrichment-dev \
  --resource-group rg-recall-dev \
  --output table
```

---

## Deploy Frontend (SWA)

### Get SWA Deployment Token

```bash
SWA_TOKEN=$(az staticwebapp secrets list \
  --name swa-recall-dev \
  --resource-group rg-recall-dev \
  --query properties.apiKey -o tsv)

echo "SWA Deployment Token: $SWA_TOKEN"
# Add this to GitHub secrets: AZURE_STATIC_WEB_APPS_API_TOKEN_DEV
```

### Deploy via SWA CLI

```bash
cd /home/adiazcan/github/recall-core/src/web

# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Build frontend
pnpm install
pnpm run build

# Deploy
swa deploy ./dist \
  --deployment-token $SWA_TOKEN \
  --env production
```

### Verify Frontend

```bash
# Get SWA URL
SWA_URL=$(az staticwebapp show \
  --name swa-recall-dev \
  --resource-group rg-recall-dev \
  --query defaultHostname -o tsv)

echo "Frontend URL: https://$SWA_URL"

# Open in browser
open "https://$SWA_URL"
```

---

## Verify Full Stack

### End-to-End Test

```bash
# 1. Get endpoints
API_URL=$(az containerapp show --name aca-recall-api-dev --resource-group rg-recall-dev --query properties.configuration.ingress.fqdn -o tsv)
SWA_URL=$(az staticwebapp show --name swa-recall-dev --resource-group rg-recall-dev --query defaultHostname -o tsv)

echo "API: https://$API_URL"
echo "Frontend: https://$SWA_URL"

# 2. Test API health
curl -s "https://$API_URL/health"
# {"status":"ok"}

# 3. Test API via SWA linked backend (if configured)
curl -s "https://$SWA_URL/api/health"
# {"status":"ok"}

# 4. Open frontend in browser
open "https://$SWA_URL"
```

### Check Observability

```bash
# View container app logs
az containerapp logs show \
  --name aca-recall-api-dev \
  --resource-group rg-recall-dev \
  --tail 50

# Query App Insights
az monitor app-insights query \
  --app appi-recall-dev \
  --resource-group rg-recall-dev \
  --analytics-query "requests | take 10"
```

---

## Troubleshooting

### Infrastructure Deployment Fails

```bash
# Check deployment status
az deployment sub show \
  --name <deployment-name> \
  --query properties.provisioningState

# View deployment operations (find errors)
az deployment sub show-operations \
  --name <deployment-name> \
  --query "[?properties.provisioningState=='Failed']"
```

### Container App Not Starting

```bash
# Check container app status
az containerapp show \
  --name aca-recall-api-dev \
  --resource-group rg-recall-dev \
  --query properties.runningStatus

# View recent logs
az containerapp logs show \
  --name aca-recall-api-dev \
  --resource-group rg-recall-dev \
  --tail 100

# Check revision status
az containerapp revision list \
  --name aca-recall-api-dev \
  --resource-group rg-recall-dev \
  --output table
```

### Key Vault Access Issues

```bash
# Verify managed identity role assignment
az role assignment list \
  --scope "/subscriptions/.../resourceGroups/rg-recall-dev/providers/Microsoft.KeyVault/vaults/kv-recall-dev" \
  --assignee <api-principal-id>

# Test secret access manually
az keyvault secret show \
  --vault-name kv-recall-dev \
  --name DocumentDbConnectionString
```

### SWA Linked Backend Not Working

```bash
# Check linked backend status
az staticwebapp show \
  --name swa-recall-dev \
  --resource-group rg-recall-dev \
  --query linkedBackends

# Verify API Container App is accessible
curl -s "https://aca-recall-api-dev.<region>.azurecontainerapps.io/health"

# For dev (Free SKU), linked backend may not work - use CORS fallback
```

---

## Cleanup (Dev Environment)

```bash
# Delete entire resource group (removes all resources)
az group delete \
  --name rg-recall-dev \
  --yes \
  --no-wait

# Or delete specific resources
az containerapp delete --name aca-recall-api-dev --resource-group rg-recall-dev --yes
az containerapp job delete --name acj-recall-enrichment-dev --resource-group rg-recall-dev --yes
az staticwebapp delete --name swa-recall-dev --resource-group rg-recall-dev --yes
```

---

## Cost Monitoring

```bash
# Check current month cost
az consumption usage list \
  --start-date $(date -d "first day of this month" +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  --query "[?contains(instanceName, 'recall')].{Name:instanceName, Cost:pretaxCost}" \
  --output table

# Set budget alert (recommended)
az consumption budget create \
  --budget-name recall-dev-budget \
  --amount 50 \
  --time-grain Monthly \
  --start-date $(date +%Y-%m-01) \
  --category Cost \
  --resource-group rg-recall-dev
```

---

## Next Steps

After successful deployment:

1. **Configure Entra Authentication**: Follow `/docs/auth/external-id-setup.md` to configure API authentication
2. **Set up Alerts**: Enable production alerts via Bicep or Azure Portal
3. **Configure Custom Domain**: Add custom domain to SWA (Standard SKU required)
4. **Enable Private Link**: Upgrade DocumentDB and Storage for private endpoint access
5. **Review Cost**: Monitor first week of usage and adjust SKUs if needed

````