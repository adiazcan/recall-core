output "storage_account_id" {
  description = "Storage account resource ID"
  value       = azurerm_storage_account.main.id
}

output "storage_account_name" {
  description = "Storage account name"
  value       = azurerm_storage_account.main.name
}

output "blob_container_name" {
  description = "Blob container name"
  value       = azurerm_storage_container.thumbnails.name
}

output "queue_name" {
  description = "Queue name"
  value       = azurerm_storage_queue.enrichment.name
}

output "primary_blob_endpoint" {
  description = "Blob service endpoint"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "primary_queue_endpoint" {
  description = "Queue service endpoint"
  value       = azurerm_storage_account.main.primary_queue_endpoint
}

output "primary_connection_string" {
  description = "Primary connection string"
  value       = "DefaultEndpointsProtocol=https;AccountName=${azurerm_storage_account.main.name};AccountKey=${azurerm_storage_account.main.primary_access_key};EndpointSuffix=core.windows.net"
  sensitive   = true
}

output "id" {
  description = "Storage account ID"
  value       = azurerm_storage_account.main.id
}
