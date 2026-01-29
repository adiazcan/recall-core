resource "azurerm_static_web_app" "main" {
  name                = "recall-web-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.static_web_app_location
  sku_tier            = var.sku_tier
  sku_size            = var.sku_tier
  tags                = var.tags
}

terraform {
  required_providers {
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.0"
    }
  }
}

resource "azapi_resource" "linked_backend" {
  type      = "Microsoft.Web/staticSites/linkedBackends@2022-09-01"
  name      = "api"
  parent_id = azurerm_static_web_app.main.id

  body = jsonencode({
    properties = {
      backendResourceId = var.container_app_api_id
      region            = var.location
    }
  })
}
