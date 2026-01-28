output "id" {
  description = "DocumentDB cluster resource ID"
  value       = azapi_resource.mongo_cluster.id
}

output "endpoint" {
  description = "DocumentDB connection endpoint"
  value       = local.documentdb_endpoint
}

output "connection_string_secret_id" {
  description = "Key Vault secret ID for connection string"
  value       = azurerm_key_vault_secret.connection_string.id
}
