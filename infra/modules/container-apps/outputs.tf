output "environment_id" {
  description = "Container Apps environment ID"
  value       = azurerm_container_app_environment.main.id
}

output "api_id" {
  description = "API container app ID"
  value       = azurerm_container_app.api.id
}

output "api_name" {
  description = "API container app name"
  value       = azurerm_container_app.api.name
}

output "api_fqdn" {
  description = "API container app FQDN"
  value       = azurerm_container_app.api.ingress[0].fqdn
}

output "enrichment_id" {
  description = "Enrichment container app ID"
  value       = azurerm_container_app.enrichment.id
}

output "enrichment_name" {
  description = "Enrichment container app name"
  value       = azurerm_container_app.enrichment.name
}

output "api_identity_principal_id" {
  description = "API managed identity principal ID"
  value       = azurerm_container_app.api.identity[0].principal_id
}

output "enrichment_identity_principal_id" {
  description = "Enrichment managed identity principal ID"
  value       = azurerm_container_app.enrichment.identity[0].principal_id
}
