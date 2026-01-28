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

output "enrichment_container_app_id" {
  description = "Enrichment Container App resource ID"
  value       = module.container_apps.enrichment_id
}

output "enrichment_container_app_name" {
  description = "Enrichment Container App name"
  value       = module.container_apps.enrichment_name
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
  description = "Application Insights connection string"
  value       = module.monitoring.app_insights_connection_string
  sensitive   = true
}

output "app_insights_instrumentation_key" {
  description = "Application Insights instrumentation key"
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
  value       = module.container_apps.enrichment_identity_principal_id
}
