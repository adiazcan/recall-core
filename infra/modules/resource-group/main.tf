resource "azurerm_resource_group" "main" {
  name     = "recall-${var.environment}-rg"
  location = var.location
  tags     = var.tags
}
