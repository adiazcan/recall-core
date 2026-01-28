output "id" {
  description = "Static Web App resource ID"
  value       = azurerm_static_web_app.main.id
}

output "name" {
  description = "Static Web App name"
  value       = azurerm_static_web_app.main.name
}

output "default_hostname" {
  description = "Static Web App default hostname"
  value       = azurerm_static_web_app.main.default_host_name
}

output "api_key" {
  description = "Static Web App deployment API key"
  value       = azurerm_static_web_app.main.api_key
  sensitive   = true
}
