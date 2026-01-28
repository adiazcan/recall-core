# Terraform Outputs Contract

**Feature**: 007-azure-infra  
**Date**: 2026-01-28  
**Status**: Complete

## Overview

This document defines the Terraform output contract - the values exposed by the root module that downstream consumers (CI/CD, documentation, other IaC) depend on.

---

## Root Module Outputs

### Resource Group

| Output | Type | Sensitive | Description |
|--------|------|-----------|-------------|
| `resource_group_name` | string | no | Environment resource group name |
| `resource_group_id` | string | no | Environment resource group ID |

### Container Apps

| Output | Type | Sensitive | Description |
|--------|------|-----------|-------------|
| `container_apps_environment_id` | string | no | ACA Environment resource ID |
| `api_container_app_id` | string | no | API Container App resource ID |
| `api_container_app_name` | string | no | API Container App name |
| `api_container_app_fqdn` | string | no | API Container App FQDN |
| `api_container_app_url` | string | no | API Container App URL (https://{fqdn}) |
| `enrichment_job_id` | string | no | Enrichment Job resource ID |
| `enrichment_job_name` | string | no | Enrichment Job name |

### Static Web App

| Output | Type | Sensitive | Description |
|--------|------|-----------|-------------|
| `static_web_app_id` | string | no | SWA resource ID |
| `static_web_app_name` | string | no | SWA name |
| `static_web_app_hostname` | string | no | SWA default hostname |
| `static_web_app_url` | string | no | SWA URL (https://{hostname}) |
| `static_web_app_api_key` | string | **yes** | SWA deployment API key |

### Storage

| Output | Type | Sensitive | Description |
|--------|------|-----------|-------------|
| `storage_account_name` | string | no | Storage account name |
| `storage_account_id` | string | no | Storage account resource ID |
| `storage_blob_endpoint` | string | no | Blob service endpoint |
| `storage_queue_endpoint` | string | no | Queue service endpoint |
| `storage_blob_container_name` | string | no | Thumbnails container name |
| `storage_queue_name` | string | no | Enrichment queue name |

### DocumentDB

| Output | Type | Sensitive | Description |
|--------|------|-----------|-------------|
| `documentdb_id` | string | no | DocumentDB cluster resource ID |
| `documentdb_endpoint` | string | no | MongoDB connection endpoint |
| `documentdb_connection_string_secret_id` | string | no | Key Vault secret ID for connection string |

### Monitoring

| Output | Type | Sensitive | Description |
|--------|------|-----------|-------------|
| `log_analytics_workspace_id` | string | no | Log Analytics Workspace resource ID |
| `log_analytics_workspace_name` | string | no | Log Analytics Workspace name |
| `app_insights_id` | string | no | Application Insights resource ID |
| `app_insights_name` | string | no | Application Insights name |
| `app_insights_connection_string` | string | **yes** | App Insights connection string |
| `app_insights_instrumentation_key` | string | **yes** | App Insights instrumentation key |

### Key Vault

| Output | Type | Sensitive | Description |
|--------|------|-----------|-------------|
| `key_vault_id` | string | no | Key Vault resource ID |
| `key_vault_name` | string | no | Key Vault name |
| `key_vault_uri` | string | no | Key Vault URI |

### Identity

| Output | Type | Sensitive | Description |
|--------|------|-----------|-------------|
| `api_identity_principal_id` | string | no | API Container App managed identity principal ID |
| `job_identity_principal_id` | string | no | Enrichment Job managed identity principal ID |

---

## Output Terraform Definition

```hcl
# infra/outputs.tf

# Resource Group
output "resource_group_name" {
  description = "Environment resource group name"
  value       = module.resource_group.name
}

output "resource_group_id" {
  description = "Environment resource group ID"
  value       = module.resource_group.id
}

# Container Apps
output "container_apps_environment_id" {
  description = "ACA Environment resource ID"
  value       = module.container_apps.environment_id
}

output "api_container_app_id" {
  description = "API Container App resource ID"
  value       = module.container_apps.api_id
}

output "api_container_app_name" {
  description = "API Container App name"
  value       = module.container_apps.api_name
}

output "api_container_app_fqdn" {
  description = "API Container App FQDN"
  value       = module.container_apps.api_fqdn
}

output "api_container_app_url" {
  description = "API Container App URL"
  value       = "https://${module.container_apps.api_fqdn}"
}

output "enrichment_job_id" {
  description = "Enrichment Job resource ID"
  value       = module.container_apps.job_id
}

output "enrichment_job_name" {
  description = "Enrichment Job name"
  value       = module.container_apps.job_name
}

# Static Web App
output "static_web_app_id" {
  description = "SWA resource ID"
  value       = module.static_web_app.id
}

output "static_web_app_name" {
  description = "SWA name"
  value       = module.static_web_app.name
}

output "static_web_app_hostname" {
  description = "SWA default hostname"
  value       = module.static_web_app.default_hostname
}

output "static_web_app_url" {
  description = "SWA URL"
  value       = "https://${module.static_web_app.default_hostname}"
}

output "static_web_app_api_key" {
  description = "SWA deployment API key"
  value       = module.static_web_app.api_key
  sensitive   = true
}

# Storage
output "storage_account_name" {
  description = "Storage account name"
  value       = module.storage.storage_account_name
}

output "storage_account_id" {
  description = "Storage account resource ID"
  value       = module.storage.storage_account_id
}

output "storage_blob_endpoint" {
  description = "Blob service endpoint"
  value       = module.storage.primary_blob_endpoint
}

output "storage_queue_endpoint" {
  description = "Queue service endpoint"
  value       = module.storage.primary_queue_endpoint
}

output "storage_blob_container_name" {
  description = "Thumbnails container name"
  value       = module.storage.blob_container_name
}

output "storage_queue_name" {
  description = "Enrichment queue name"
  value       = module.storage.queue_name
}

# DocumentDB
output "documentdb_id" {
  description = "DocumentDB cluster resource ID"
  value       = module.documentdb.id
}

output "documentdb_endpoint" {
  description = "MongoDB connection endpoint"
  value       = module.documentdb.endpoint
}

output "documentdb_connection_string_secret_id" {
  description = "Key Vault secret ID for connection string"
  value       = module.documentdb.connection_string_secret_id
}

# Monitoring
output "log_analytics_workspace_id" {
  description = "Log Analytics Workspace resource ID"
  value       = module.monitoring.log_analytics_workspace_id
}

output "log_analytics_workspace_name" {
  description = "Log Analytics Workspace name"
  value       = module.monitoring.log_analytics_workspace_name
}

output "app_insights_id" {
  description = "Application Insights resource ID"
  value       = module.monitoring.app_insights_id
}

output "app_insights_name" {
  description = "Application Insights name"
  value       = module.monitoring.app_insights_name
}

output "app_insights_connection_string" {
  description = "App Insights connection string"
  value       = module.monitoring.app_insights_connection_string
  sensitive   = true
}

output "app_insights_instrumentation_key" {
  description = "App Insights instrumentation key"
  value       = module.monitoring.app_insights_instrumentation_key
  sensitive   = true
}

# Key Vault
output "key_vault_id" {
  description = "Key Vault resource ID"
  value       = module.keyvault.id
}

output "key_vault_name" {
  description = "Key Vault name"
  value       = module.keyvault.name
}

output "key_vault_uri" {
  description = "Key Vault URI"
  value       = module.keyvault.vault_uri
}

# Identity
output "api_identity_principal_id" {
  description = "API managed identity principal ID"
  value       = module.container_apps.api_identity_principal_id
}

output "job_identity_principal_id" {
  description = "Job managed identity principal ID"
  value       = module.container_apps.job_identity_principal_id
}
```

---

## Consumer Contracts

### GitHub Actions Workflow Consumers

The following outputs are consumed by deployment workflows:

| Workflow | Outputs Used | Purpose |
|----------|--------------|---------|
| `api-deploy.yml` | `api_container_app_name`, `resource_group_name` | Target for revision update |
| `enrichment-deploy.yml` | `enrichment_job_name`, `resource_group_name` | Target for job image update |
| `web-deploy.yml` | `static_web_app_api_key` | SWA deployment authentication |

### Application Configuration

Containers receive configuration via environment variables set from Terraform outputs:

| Container | Environment Variable | Source Output |
|-----------|---------------------|---------------|
| API | `APPLICATIONINSIGHTS_CONNECTION_STRING` | `app_insights_connection_string` |
| API | `Storage__BlobEndpoint` | `storage_blob_endpoint` |
| API | `Storage__QueueEndpoint` | `storage_queue_endpoint` |
| API | `Storage__ThumbnailsContainer` | `storage_blob_container_name` |
| API | `Storage__EnrichmentQueue` | `storage_queue_name` |
| Job | `APPLICATIONINSIGHTS_CONNECTION_STRING` | `app_insights_connection_string` |
| Job | `Storage__BlobEndpoint` | `storage_blob_endpoint` |
| Job | `Storage__QueueEndpoint` | `storage_queue_endpoint` |

---

## State Output Access

To retrieve outputs from deployed infrastructure:

```bash
# Get all outputs
cd infra
terraform output -json

# Get specific output
terraform output api_container_app_url

# Get sensitive output
terraform output -raw static_web_app_api_key
```
