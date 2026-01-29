data "azurerm_client_config" "current" {}

resource "random_password" "admin" {
  length           = 32
  special          = true
  override_special = "!@#$%&_+-="
}

terraform {
  required_providers {
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.0"
    }
  }
}

resource "azapi_resource" "mongo_cluster" {
  type      = "Microsoft.DocumentDB/mongoClusters@2024-07-01"
  name      = "recall-${var.environment}-docdb"
  location  = var.location
  parent_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${var.resource_group_name}"
  tags      = var.tags

  body = {
    properties = {
      administrator = {
        userName = var.administrator_login
        password = random_password.admin.result
      }
      serverVersion = "7.0"
      compute = {
        tier = var.sku_tier
      }
      storage = {
        sizeGb = var.storage_size_gb
      }
      highAvailability = {
        targetMode = var.environment == "prod" ? "ZoneRedundantPreferred" : "Disabled"
      }
      sharding = {
        enabled = var.environment == "prod" ? true : false
      }
      publicNetworkAccess = "Enabled"
    }
  }
}

locals {
  documentdb_output            = try(jsondecode(azapi_resource.mongo_cluster.output), {})
  documentdb_connection_string = try(local.documentdb_output.properties.connectionString, "")
  documentdb_endpoint          = try(local.documentdb_output.properties.hostName, "")
}

resource "azurerm_key_vault_secret" "connection_string" {
  name         = "documentdb-connection-string"
  value        = local.documentdb_connection_string
  key_vault_id = var.key_vault_id

  depends_on = [azapi_resource.mongo_cluster, var.key_vault_rbac_ready]
}
