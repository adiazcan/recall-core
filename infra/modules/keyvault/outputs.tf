output "id" {
  description = "Key Vault resource ID"
  value       = azurerm_key_vault.main.id
}

output "name" {
  description = "Key Vault name"
  value       = azurerm_key_vault.main.name
}

output "vault_uri" {
  description = "Key Vault URI"
  value       = azurerm_key_vault.main.vault_uri
}

output "terraform_rbac_ready" {
  description = "Signals that Terraform has RBAC permissions configured"
  value       = azurerm_role_assignment.terraform_secrets_officer.id
}
