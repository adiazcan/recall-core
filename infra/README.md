# Infrastructure Deployment

This directory contains the Bicep infrastructure-as-code templates for deploying the Recall application to Azure.

## Prerequisites

- Azure CLI installed and configured
- Azure subscription with appropriate permissions
- Service principal with **User Access Administrator** role (for automated deployments)

⚠️ **IMPORTANT**: See [DEPLOYMENT_PERMISSIONS.md](./DEPLOYMENT_PERMISSIONS.md) for required permissions.

## Quick Start

### Validate Permissions

Before deploying, validate that you have the required permissions:

```bash
./validate-permissions.sh
```

### Deploy Infrastructure

```bash
# For dev environment
az deployment sub create \
  --location westeurope \
  --template-file main.bicep \
  --parameters parameters/dev.bicepparam \
  --name recall-dev-$(date +%s)

# For prod environment
az deployment sub create \
  --location westeurope \
  --template-file main.bicep \
  --parameters parameters/prod.bicepparam \
  --name recall-prod-$(date +%s)
```

### Using GitHub Actions

The [infra-deploy.yml](../.github/workflows/infra-deploy.yml) workflow automates infrastructure deployment:

1. Go to **Actions** → **Deploy Infrastructure**
2. Click **Run workflow**
3. Select environment (dev/prod)
4. Click **Run workflow**

## Architecture Overview

The infrastructure consists of:

### Core Services
- **Resource Group**: `rg-recall-{env}`
- **Log Analytics Workspace**: Centralized logging
- **Application Insights**: Application monitoring and telemetry
- **Key Vault**: Secrets management (connection strings, keys)
- **App Configuration**: Application settings and feature flags

### Container Infrastructure
- **Container Registry**: Docker images for API and enrichment job
- **Container Apps Environment**: Managed Kubernetes environment
- **Container App (API)**: REST API with auto-scaling
- **Container App Job**: Event-driven enrichment processing

### Data Services
- **Azure Cosmos DB for MongoDB**: Document database
- **Storage Account**: Blob storage (thumbnails) and Queue storage (enrichment jobs)

### Frontend
- **Static Web App**: React frontend with optional linked backend

### Observability
- **Action Groups** (prod only): Alert notifications
- **Metric Alerts** (prod only): Availability and performance monitoring

## Environment Configuration

### Dev Environment
- Free/Basic SKUs where available
- Shorter log retention (30 days)
- API can scale to zero
- Soft delete retention: 7 days
- DocumentDB: M25 tier, 32 GB disk

### Prod Environment
- Standard/Premium SKUs
- Extended log retention (90 days)
- API minimum 1 replica
- Purge protection enabled
- Soft delete retention: 30 days
- DocumentDB: M40 tier, 64 GB disk, HA enabled
- Monitoring and alerting enabled

## Role Assignments

The deployment creates several role assignments to grant managed identities access to resources:

| Identity | Resource | Role | Purpose |
|----------|----------|------|---------|
| API Container App | Key Vault | Key Vault Secrets User | Read DB connection string |
| API Container App | App Configuration | App Configuration Data Reader | Read app settings |
| API Container App | Container Registry | ACR Pull | Pull container images |
| API Container App | Storage Account | Blob/Queue Contributor | Access storage |
| Enrichment Job | Key Vault | Key Vault Secrets User | Read DB connection string |
| Enrichment Job | App Configuration | App Configuration Data Reader | Read app settings |
| Enrichment Job | Container Registry | ACR Pull | Pull container images |
| Enrichment Job | Storage Account | Blob/Queue Contributor | Process enrichment jobs |

⚠️ Creating these role assignments requires the deployment principal to have **User Access Administrator** permissions. See [DEPLOYMENT_PERMISSIONS.md](./DEPLOYMENT_PERMISSIONS.md) for details.

## Module Structure

```
infra/
├── main.bicep                          # Main orchestration template
├── parameters/
│   ├── dev.bicepparam                  # Dev environment parameters
│   └── prod.bicepparam                 # Prod environment parameters
├── modules/
│   ├── core/
│   │   ├── resource-group.bicep        # Resource group
│   │   ├── log-analytics.bicep         # Log Analytics workspace
│   │   ├── app-insights.bicep          # Application Insights
│   │   ├── key-vault.bicep             # Key Vault
│   │   ├── app-configuration.bicep     # App Configuration
│   │   └── alerts.bicep                # Monitoring alerts
│   ├── container/
│   │   ├── container-registry.bicep    # Container Registry
│   │   ├── container-apps-env.bicep    # Container Apps Environment
│   │   ├── container-app-api.bicep     # API Container App
│   │   └── container-app-job.bicep     # Enrichment Job
│   ├── database/
│   │   └── documentdb.bicep            # Cosmos DB for MongoDB
│   ├── storage/
│   │   ├── storage-account.bicep       # Storage Account
│   │   └── storage-roles.bicep         # Storage role assignments
│   └── web/
│       └── static-web-app.bicep        # Static Web App (frontend)
├── DEPLOYMENT_PERMISSIONS.md           # Permissions documentation
├── validate-permissions.sh             # Pre-deployment validation
└── README.md                           # This file
```

## Troubleshooting

### Authorization Errors

If you see errors like:
```
Authorization failed for template resource ... does not have permission to perform action 'Microsoft.Authorization/roleAssignments/write'
```

**Solution**: Grant User Access Administrator role to the deployment principal. See [DEPLOYMENT_PERMISSIONS.md](./DEPLOYMENT_PERMISSIONS.md).

### Deployment Timeout

DocumentDB cluster creation can take 10-20 minutes. If deployment times out:

1. Check the Azure Portal for deployment progress
2. Wait for resources to complete provisioning
3. Re-run the deployment (it will update existing resources)

### Resource Name Conflicts

If resources already exist with the same names, the deployment will update them. To avoid conflicts:

1. Use different environment names (`dev`, `prod`, `test`, etc.)
2. Manually delete resources if needed (be careful with data!)
3. Check resource group contents before deploying

## Security Best Practices

- ✅ All resources use RBAC (no shared keys/passwords except DB admin)
- ✅ Key Vault secrets are referenced securely via managed identities
- ✅ Network isolation (when possible in Container Apps)
- ✅ HTTPS only for all services
- ✅ Infrastructure encryption enabled
- ✅ Purge protection enabled in production
- ✅ Diagnostic logs enabled for audit trails

## Cost Optimization

### Dev Environment
- Free/Basic SKUs reduce costs
- API can scale to zero when not in use
- Shorter log retention (30 days)
- Estimated cost: ~$100-200/month

### Prod Environment
- Standard SKUs for reliability
- Always-on API (minimum 1 replica)
- Extended log retention (90 days)
- HA enabled for DocumentDB
- Estimated cost: ~$400-600/month

## References

- [Azure Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [Azure Verified Modules](https://aka.ms/avm)
- [Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Cosmos DB for MongoDB Documentation](https://learn.microsoft.com/azure/cosmos-db/mongodb/)
