data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                          = "recall-${var.environment}-kv"
  location                      = var.location
  resource_group_name           = var.resource_group_name
  tenant_id                     = var.tenant_id != null ? var.tenant_id : data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  soft_delete_retention_days    = 7
  purge_protection_enabled      = false
  public_network_access_enabled = true
  tags                          = var.tags
}
