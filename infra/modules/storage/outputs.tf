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

output "connection_string_secret_id" {
  description = "Key Vault secret ID for storage connection string"
  value       = azurerm_key_vault_secret.storage_connection_string.id
}
