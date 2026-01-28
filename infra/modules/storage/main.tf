locals {
  storage_account_name = "recall${var.environment}st"
}

resource "azurerm_storage_account" "main" {
  name                            = local.storage_account_name
  resource_group_name             = var.resource_group_name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  account_kind                    = "StorageV2"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  https_traffic_only_enabled      = true
  public_network_access_enabled   = true
  tags                            = var.tags
}

resource "azurerm_storage_container" "thumbnails" {
  name                  = var.blob_container_name
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_storage_queue" "enrichment" {
  name                 = var.queue_name
  storage_account_name = azurerm_storage_account.main.name
}
