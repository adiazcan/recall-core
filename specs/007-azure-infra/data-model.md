# Data Model: Azure Infrastructure Landing Zone

**Feature**: 007-azure-infra  
**Date**: 2026-01-28  
**Status**: Complete

## Overview

This document defines the Azure resource topology and Terraform module structure for recall-core infrastructure. In the context of IaC, the "data model" represents the resource graph, module interfaces, and configuration schemas.

---

## Resource Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Azure Subscription                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────┐    ┌────────────────────────────────────────┐  │
│  │  recall-tfstate-rg     │    │  recall-{env}-rg                       │  │
│  │  (bootstrap, shared)   │    │  (per environment)                     │  │
│  │                        │    │                                        │  │
│  │  ┌──────────────────┐  │    │  ┌────────────────────────────────┐   │  │
│  │  │ recalltfstate    │  │    │  │ Monitoring                     │   │  │
│  │  │ (Storage Account │  │    │  │  ├─ recall-{env}-law (Log Analytics)│ │
│  │  │  for TF state)   │  │    │  │  └─ recall-{env}-ai (App Insights)│ │  │
│  │  └──────────────────┘  │    │  └────────────────────────────────┘   │  │
│  └────────────────────────┘    │                                        │  │
│                                │  ┌────────────────────────────────┐   │  │
│  ┌────────────────────────┐    │  │ Secrets                        │   │  │
│  │  recall-shared-rg      │    │  │  └─ recall-{env}-kv (Key Vault)│   │  │
│  │  (shared resources)    │    │  └────────────────────────────────┘   │  │
│  │                        │    │                                        │  │
│  │  ┌──────────────────┐  │    │  ┌────────────────────────────────┐   │  │
│  │  │ recallacr (ACR)  │  │    │  │ Data                           │   │  │
│  │  │ Container        │  │    │  │  ├─ recall-{env}-docdb         │   │  │
│  │  │ Registry         │  │    │  │  │  (DocumentDB MongoDB)       │   │  │
│  │  └──────────────────┘  │    │  │  └─ recall{env}st              │   │  │
│  └────────────────────────┘    │  │     (Storage Account)          │   │  │
│                                │  │       ├─ thumbnails (blob)     │   │  │
│                                │  │       └─ enrichment-queue      │   │  │
│                                │  └────────────────────────────────┘   │  │
│                                │                                        │  │
│                                │  ┌────────────────────────────────┐   │  │
│                                │  │ Compute                        │   │  │
│                                │  │  ├─ recall-{env}-cae           │   │  │
│                                │  │  │  (Container Apps Env)       │   │  │
│                                │  │  │    ├─ recall-api-{env}      │   │  │
│                                │  │  │    │  (Container App)       │   │  │
│                                │  │  │    └─ recall-job-{env}      │   │  │
│                                │  │  │       (Container Apps Job)  │   │  │
│                                │  │  └─ recall-web-{env}           │   │  │
│                                │  │     (Static Web App)           │   │  │
│                                │  └────────────────────────────────┘   │  │
│                                │                                        │  │
│                                └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Terraform Module Structure

### Root Module Composition

```hcl
# infra/main.tf - Module composition

module "resource_group" {
  source      = "./modules/resource-group"
  environment = var.environment
  location    = var.location
  tags        = local.common_tags
}

module "monitoring" {
  source              = "./modules/monitoring"
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = local.common_tags
}

module "keyvault" {
  source              = "./modules/keyvault"
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = local.common_tags
}

module "storage" {
  source              = "./modules/storage"
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = local.common_tags
}

module "documentdb" {
  source              = "./modules/documentdb"
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  key_vault_id        = module.keyvault.id
  tags                = local.common_tags
}

module "container_apps" {
  source                            = "./modules/container-apps"
  environment                       = var.environment
  location                          = var.location
  resource_group_name               = module.resource_group.name
  log_analytics_workspace_id        = module.monitoring.log_analytics_workspace_id
  app_insights_connection_string    = module.monitoring.app_insights_connection_string
  key_vault_id                      = module.keyvault.id
  storage_account_name              = module.storage.storage_account_name
  storage_queue_name                = module.storage.queue_name
  storage_blob_container_name       = module.storage.blob_container_name
  documentdb_connection_string_secret_id = module.documentdb.connection_string_secret_id
  acr_login_server                  = var.acr_login_server
  api_image                         = var.api_image
  enrichment_image                  = var.enrichment_image
  tags                              = local.common_tags
}

module "static_web_app" {
  source                 = "./modules/static-web-app"
  environment            = var.environment
  location               = var.location
  resource_group_name    = module.resource_group.name
  container_app_api_id   = module.container_apps.api_id
  container_app_api_fqdn = module.container_apps.api_fqdn
  tags                   = local.common_tags
}
```

---

## Module Interfaces

### Module: resource-group

**Purpose**: Creates the environment-specific resource group.

**Inputs**:
| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `environment` | string | yes | Environment name (dev/prod) |
| `location` | string | yes | Azure region |
| `tags` | map(string) | yes | Resource tags |

**Outputs**:
| Output | Type | Description |
|--------|------|-------------|
| `name` | string | Resource group name |
| `id` | string | Resource group ID |

---

### Module: monitoring

**Purpose**: Creates Log Analytics workspace and Application Insights.

**Inputs**:
| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `environment` | string | yes | Environment name |
| `location` | string | yes | Azure region |
| `resource_group_name` | string | yes | Target resource group |
| `retention_days` | number | no | Log retention (default: 30) |
| `tags` | map(string) | yes | Resource tags |

**Outputs**:
| Output | Type | Description |
|--------|------|-------------|
| `log_analytics_workspace_id` | string | LAW resource ID |
| `log_analytics_workspace_key` | string | LAW primary key (sensitive) |
| `app_insights_id` | string | App Insights resource ID |
| `app_insights_connection_string` | string | App Insights connection string (sensitive) |
| `app_insights_instrumentation_key` | string | App Insights instrumentation key (sensitive) |

---

### Module: keyvault

**Purpose**: Creates Key Vault with RBAC authorization.

**Inputs**:
| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `environment` | string | yes | Environment name |
| `location` | string | yes | Azure region |
| `resource_group_name` | string | yes | Target resource group |
| `tenant_id` | string | no | Azure AD tenant (defaults to current) |
| `tags` | map(string) | yes | Resource tags |

**Outputs**:
| Output | Type | Description |
|--------|------|-------------|
| `id` | string | Key Vault resource ID |
| `name` | string | Key Vault name |
| `vault_uri` | string | Key Vault URI |

---

### Module: storage

**Purpose**: Creates Storage Account with blob container and queue.

**Inputs**:
| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `environment` | string | yes | Environment name |
| `location` | string | yes | Azure region |
| `resource_group_name` | string | yes | Target resource group |
| `blob_container_name` | string | no | Blob container name (default: thumbnails) |
| `queue_name` | string | no | Queue name (default: enrichment-queue) |
| `tags` | map(string) | yes | Resource tags |

**Outputs**:
| Output | Type | Description |
|--------|------|-------------|
| `storage_account_id` | string | Storage account resource ID |
| `storage_account_name` | string | Storage account name |
| `blob_container_name` | string | Blob container name |
| `queue_name` | string | Queue name |
| `primary_blob_endpoint` | string | Blob service endpoint |
| `primary_queue_endpoint` | string | Queue service endpoint |

---

### Module: documentdb

**Purpose**: Creates Azure DocumentDB (MongoDB vCore) cluster.

**Inputs**:
| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `environment` | string | yes | Environment name |
| `location` | string | yes | Azure region |
| `resource_group_name` | string | yes | Target resource group |
| `key_vault_id` | string | yes | Key Vault for storing connection string |
| `administrator_login` | string | no | Admin username (default: recalladmin) |
| `database_name` | string | no | Database name (default: recalldb) |
| `sku_tier` | string | no | SKU tier (default: M25) |
| `storage_size_gb` | number | no | Storage size (default: 32) |
| `tags` | map(string) | yes | Resource tags |

**Outputs**:
| Output | Type | Description |
|--------|------|-------------|
| `id` | string | DocumentDB cluster ID |
| `endpoint` | string | MongoDB connection endpoint |
| `connection_string_secret_id` | string | Key Vault secret ID for connection string |

---

### Module: container-apps

**Purpose**: Creates ACA Environment, API Container App, and Enrichment Job.

**Inputs**:
| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `environment` | string | yes | Environment name |
| `location` | string | yes | Azure region |
| `resource_group_name` | string | yes | Target resource group |
| `log_analytics_workspace_id` | string | yes | LAW for ACA logs |
| `app_insights_connection_string` | string | yes | App Insights for OTel |
| `key_vault_id` | string | yes | Key Vault for secret references |
| `storage_account_name` | string | yes | Storage account for queue/blob |
| `storage_queue_name` | string | yes | Queue name for job trigger |
| `storage_blob_container_name` | string | yes | Blob container for thumbnails |
| `documentdb_connection_string_secret_id` | string | yes | KV secret ID for DB connection |
| `acr_login_server` | string | yes | ACR server URL |
| `api_image` | string | yes | API container image tag |
| `enrichment_image` | string | yes | Enrichment container image tag |
| `api_min_replicas` | number | no | API min replicas (default: 0 dev, 1 prod) |
| `api_max_replicas` | number | no | API max replicas (default: 3) |
| `tags` | map(string) | yes | Resource tags |

**Outputs**:
| Output | Type | Description |
|--------|------|-------------|
| `environment_id` | string | ACA Environment ID |
| `api_id` | string | API Container App ID |
| `api_fqdn` | string | API Container App FQDN |
| `api_url` | string | API Container App URL (https://) |
| `job_id` | string | Enrichment Job ID |
| `api_identity_principal_id` | string | API managed identity principal ID |
| `job_identity_principal_id` | string | Job managed identity principal ID |

---

### Module: static-web-app

**Purpose**: Creates Static Web App with linked API backend.

**Inputs**:
| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `environment` | string | yes | Environment name |
| `location` | string | yes | Azure region |
| `resource_group_name` | string | yes | Target resource group |
| `container_app_api_id` | string | yes | API Container App ID for linking |
| `container_app_api_fqdn` | string | yes | API Container App FQDN |
| `sku_tier` | string | no | SWA SKU (default: Standard) |
| `tags` | map(string) | yes | Resource tags |

**Outputs**:
| Output | Type | Description |
|--------|------|-------------|
| `id` | string | SWA resource ID |
| `name` | string | SWA name |
| `default_hostname` | string | SWA default hostname |
| `api_key` | string | SWA deployment API key (sensitive) |

---

## Variable Definitions

### Root Variables (infra/variables.tf)

```hcl
variable "environment" {
  type        = string
  description = "Environment name (dev or prod)"
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be dev or prod."
  }
}

variable "location" {
  type        = string
  description = "Azure region for all resources"
  default     = "swedencentral"
}

variable "acr_login_server" {
  type        = string
  description = "ACR login server URL"
  default     = "recallacr.azurecr.io"
}

variable "api_image" {
  type        = string
  description = "Full API container image reference"
}

variable "enrichment_image" {
  type        = string
  description = "Full enrichment container image reference"
}
```

### Environment-specific Values

**infra/environments/dev.tfvars**:
```hcl
environment       = "dev"
location          = "swedencentral"
api_image         = "recallacr.azurecr.io/recall-api:dev-latest"
enrichment_image  = "recallacr.azurecr.io/recall-enrichment:dev-latest"
```

**infra/environments/prod.tfvars**:
```hcl
environment       = "prod"
location          = "swedencentral"
api_image         = "recallacr.azurecr.io/recall-api:prod-latest"
enrichment_image  = "recallacr.azurecr.io/recall-enrichment:prod-latest"
```

---

## Resource Dependencies

```
resource_group
    │
    ├──► monitoring (LAW, App Insights)
    │
    ├──► keyvault
    │       │
    │       └──► documentdb (stores connection string)
    │               │
    ├──► storage    │
    │       │       │
    │       └───────┴──► container_apps
    │                       │
    └───────────────────────┴──► static_web_app (links to API)
```

---

## RBAC Assignments (Created by Modules)

| Principal | Role | Scope | Module |
|-----------|------|-------|--------|
| API Container App MI | Key Vault Secrets User | Key Vault | keyvault |
| API Container App MI | Storage Blob Data Contributor | Storage Account | storage |
| API Container App MI | Storage Queue Data Contributor | Storage Account | storage |
| Job MI | Key Vault Secrets User | Key Vault | keyvault |
| Job MI | Storage Blob Data Contributor | Storage Account | storage |
| Job MI | Storage Queue Data Contributor | Storage Account | storage |
| ACA Environment | AcrPull | ACR | container-apps |

---

## Security Configuration

### Key Vault
- RBAC authorization mode (no access policies)
- Soft delete enabled (7 days)
- Purge protection disabled (dev convenience)
- Network: Public access allowed (MVP)

### Storage Account
- Public blob access: Disabled
- Minimum TLS: 1.2
- HTTPS required: true
- Network: Public access allowed (MVP)
- SAS tokens: Disabled; apps use managed identity where supported and storage account keys/connection strings are provided via Key Vault references for BlobServiceClient and Dapr Azure Storage Queues.

### DocumentDB
- Authentication: Admin password in Key Vault
- Network: Public access (MVP)
- TLS: Required
