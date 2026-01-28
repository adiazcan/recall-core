# Research: Azure Infrastructure Landing Zone

**Feature**: 007-azure-infra  
**Date**: 2026-01-28  
**Status**: Complete

## Executive Summary

This document captures research decisions for deploying recall-core to Azure using Terraform IaC. All NEEDS CLARIFICATION items from the Technical Context have been resolved.

---

## Decision 1: IaC Tool Selection

**Decision**: Terraform with azurerm provider

**Rationale**:
- User explicitly specified Terraform
- Mature Azure provider (azurerm 4.x) with comprehensive resource coverage
- State management supports team collaboration via remote backends
- Plan/apply workflow provides safe infrastructure changes
- Existing team familiarity assumed based on user preference

**Alternatives Considered**:
| Option | Pros | Cons | Rejected Because |
|--------|------|------|------------------|
| Bicep | Azure-native, no state file | Azure-only, less ecosystem | User specified Terraform |
| Pulumi | Full programming languages | Requires SDK learning | User specified Terraform |
| ARM Templates | Native JSON format | Verbose, hard to maintain | User specified Terraform |

---

## Decision 2: Azure Region Selection

**Decision**: Sweden Central (swedencentral)

**Rationale**:
- Cost-effective region with good availability
- All required services available (ACA, SWA, DocumentDB, Storage)
- Suitable latency profile for Northern Europe; not optimized for low-latency US access
- Paired region (Sweden South) for future DR, following Azure regional pair guidance

**Alternatives Considered**:
| Region | Pros | Cons | Rejected Because |
|--------|------|------|------------------|
| West Europe | Good for EU users | Higher latency for US user | User likely US-based |
| Central US | Lower cost | Fewer availability zones | eastus2 more feature-complete |
| East US | Original Azure region | Can be congested | eastus2 has better capacity |

---

## Decision 3: Azure DocumentDB Configuration

**Decision**: Azure DocumentDB (MongoDB-compatible vCore cluster)

**Rationale**:
- Azure DocumentDB is a fully managed MongoDB-compatible database service
- Native MongoDB wire protocol compatibility with existing MongoDB.Driver code
- vCore-based pricing is predictable and cost-effective
- Supports native MongoDB features (aggregation, indexes, change streams)
- Built-in high availability and automated backups

**Configuration**:
```hcl
# Azure DocumentDB requires azapi provider (azurerm support pending)
resource "azapi_resource" "documentdb" {
  type = "Microsoft.DocumentDB/mongoClusters@2024-07-01"
  name = "recall-${var.environment}-docdb"
  location = var.location
  parent_id = azurerm_resource_group.main.id
  
  body = jsonencode({
    properties = {
      administrator = {
        userName = var.documentdb_admin_username
        password = var.documentdb_admin_password
      }
      serverVersion = "7.0"
      compute = {
        tier = var.environment == "prod" ? "M30" : "M25"
      }
      storage = {
        sizeGb = 32
      }
      highAvailability = {
        targetMode = var.environment == "prod" ? "ZoneRedundantPreferred" : "Disabled"
      }
    }
  })
}
```

**Connection Strategy**:
- Store connection string in Key Vault
- API retrieves via managed identity + Key Vault reference
- No connection string in environment variables

---

## Decision 4: Azure Container Apps Architecture

**Decision**: Consumption-tier ACA Environment with separate Container App and Job

**Rationale**:
- Consumption tier = pay only for actual usage (critical for single-user prod)
- Container App (API): Always-on with scale-to-zero for cost savings
- Container Apps Job (Enrichment): Event-driven by Storage Queue
- No permanent worker running = significant cost savings

**Scaling Configuration**:
| Component | Min Replicas | Max Replicas | Trigger |
|-----------|--------------|--------------|---------|
| recall-api | 0 (dev) / 1 (prod) | 3 | HTTP requests |
| recall-job | 0 | 5 | Storage Queue depth |

**Container Resources**:
- API: 0.25 vCPU / 0.5 GB (dev), 0.5 vCPU / 1 GB (prod)
- Job: 0.5 vCPU / 1 GB (same for dev/prod - runs briefly)

---

## Decision 5: Static Web App Configuration

**Decision**: Standard tier SWA with linked backend

**Rationale**:
- Free tier limitations (no linked backends, limited build minutes)
- Standard tier enables `linkedBackend` to ACA API container
- Linked backend proxies `/api/*` requests → eliminates CORS complexity
- SWA handles HTTPS termination and CDN distribution

**API Linking**:
```hcl
resource "azurerm_static_web_app" "web" {
  # ...
}

# Link backend via azapi (not natively supported in azurerm)
resource "azapi_resource" "swa_backend" {
  type      = "Microsoft.Web/staticSites/linkedBackends@2022-09-01"
  parent_id = azurerm_static_web_app.web.id
  name      = "api"
  body = jsonencode({
    properties = {
      backendResourceId = azurerm_container_app.api.id
      region            = var.location
    }
  })
}
```

**Frontend Configuration**:
- API base URL: `/api` (relative, uses linked backend proxy)
- No VITE_API_BASE_URL needed in production
- Development still uses localhost:5080

---

## Decision 6: Storage Account Configuration

**Decision**: Single Storage Account with Blob container and Queue

**Rationale**:
- Standard_LRS sufficient for single-user thumbnails (no geo-replication needed)
- Public access disabled; all access via managed identity
- Blob container: `thumbnails` (private)
- Queue: `enrichment-queue` (triggers ACA Job)

**RBAC Assignments**:
| Principal | Role | Scope |
|-----------|------|-------|
| recall-api MI | Storage Blob Data Contributor | thumbnails container |
| recall-api MI | Storage Queue Data Contributor | enrichment-queue |
| recall-job MI | Storage Blob Data Contributor | thumbnails container |
| recall-job MI | Storage Queue Data Contributor | enrichment-queue |

---

## Decision 7: Observability Stack

**Decision**: Workspace-based Application Insights with OpenTelemetry export

**Rationale**:
- Log Analytics workspace provides data retention and querying
- App Insights connected to workspace for integrated APM experience
- OpenTelemetry SDK already configured in ServiceDefaults project
- Azure Monitor exporter sends OTLP data to App Insights

**Configuration Flow**:
```
API/Job Container → OTel SDK → OTLP Exporter → App Insights → Log Analytics
```

**Environment Variables for Containers**:
```
APPLICATIONINSIGHTS_CONNECTION_STRING=<from-app-insights>
OTEL_EXPORTER_OTLP_ENDPOINT=<optional-if-using-azure-monitor-exporter>
```

**Existing ServiceDefaults Integration**:
The `Recall.Core.ServiceDefaults` project already configures OpenTelemetry. We need to add Azure Monitor exporter:
```csharp
// Already in ServiceDefaults - just needs connection string
builder.Services.AddOpenTelemetry()
    .UseAzureMonitor(); // Reads APPLICATIONINSIGHTS_CONNECTION_STRING
```

---

## Decision 8: Key Vault and Secrets Management

**Decision**: Key Vault with RBAC authorization (no access policies)

**Rationale**:
- RBAC-only is the modern best practice (no vault access policies)
- Managed identities get `Key Vault Secrets User` role
- Secrets stored: DocumentDB connection string, app-specific secrets
- Non-secret config via App Configuration or environment variables

**Secrets Stored**:
| Secret Name | Source | Consumers |
|-------------|--------|-----------|
| `documentdb-connection-string` | DocumentDB provisioning | API, Job |
| `app-insights-connection-string` | App Insights provisioning | API, Job |

**ACA Secret References**:
```hcl
secret {
  name  = "documentdb-connection-string"
  key_vault_secret_id = azurerm_key_vault_secret.docdb.versionless_id
  identity            = "system"
}
```

---

## Decision 9: CI/CD Workflow Strategy

**Decision**: Separate workflows for infra, API, enrichment, and web

**Rationale**:
- Independent release cycles for each component
- Infra changes require manual approval (protection rule)
- API/Enrichment deploy on main branch push (with image tag)
- Web deploys via SWA GitHub integration

**Workflows**:

| Workflow | Trigger | Actions |
|----------|---------|---------|
| `infra-deploy.yml` | Manual (workflow_dispatch) | terraform plan → approve → apply |
| `api-deploy.yml` | Push to main (src/Recall.Core.Api/**) | Build image → Push to ACR → Update ACA revision |
| `enrichment-deploy.yml` | Push to main (src/Recall.Core.Enrichment/**) | Build image → Push to ACR → Update ACA Job |
| `web-deploy.yml` | Push to main (src/web/**) | Build → Deploy to SWA |

**Authentication**:
- OIDC federation for Azure (no stored credentials)
- Federated identity credential from GitHub to Azure AD app registration
- Per-environment secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`

---

## Decision 10: Container Registry Strategy

**Decision**: Single shared Azure Container Registry (ACR)

**Rationale**:
- ACR is environment-agnostic; images are tagged per environment
- Basic tier sufficient for low volume
- Both dev and prod ACA pull from same registry with different tags
- ACA uses managed identity to pull images (no admin credentials)

**Image Tagging**:
```
recallacr.azurecr.io/recall-api:dev-{sha}
recallacr.azurecr.io/recall-api:prod-{sha}
recallacr.azurecr.io/recall-enrichment:dev-{sha}
recallacr.azurecr.io/recall-enrichment:prod-{sha}
```

**RBAC**:
| Principal | Role | Scope |
|-----------|------|-------|
| ACA Environment MI (dev) | AcrPull | ACR |
| ACA Environment MI (prod) | AcrPull | ACR |
| GitHub Actions SP | AcrPush | ACR |

---

## Decision 11: Network Architecture

**Decision**: Public endpoints for MVP (private endpoints deferred)

**Rationale**:
- Private endpoints add complexity and cost (VNet, private DNS zones)
- Single-user production doesn't require network isolation
- All services secured by authentication:
  - API: JWT Bearer auth (Entra External ID)
  - DocumentDB: Connection string in Key Vault
  - Storage: Managed identity RBAC
  - Key Vault: Managed identity RBAC

**Future Enhancement** (out of scope):
- VNet integration for ACA
- Private endpoints for DocumentDB, Storage, Key Vault
- Service endpoints as cost-effective alternative

---

## Decision 12: Terraform State Management

**Decision**: Azure Storage Account backend for remote state

**Rationale**:
- State file stored securely in Azure Blob Storage
- State locking via blob leasing
- Supports team collaboration (single-user for now, but scalable)
- Separate state file per environment

**Backend Configuration**:
```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "recall-tfstate-rg"
    storage_account_name = "recalltfstate"
    container_name       = "tfstate"
    key                  = "${var.environment}.tfstate"
  }
}
```

**Bootstrap** (one-time manual):
1. Create resource group: `recall-tfstate-rg`
2. Create storage account: `recalltfstate`
3. Create container: `tfstate`
4. Assign GitHub Actions SP the `Storage Blob Data Contributor` role

---

## Unresolved Items

None. All technical decisions have been made.

---

## References

- [Azure Container Apps documentation](https://learn.microsoft.com/azure/container-apps/)
- [Azure Static Web Apps linked backends](https://learn.microsoft.com/azure/static-web-apps/apis-container-apps)
- [Azure DocumentDB overview](https://learn.microsoft.com/azure/documentdb/overview)
- [Terraform azurerm provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Terraform azapi provider](https://registry.terraform.io/providers/Azure/azapi/latest/docs)
- [OpenTelemetry Azure Monitor exporter](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable)
