terraform {
  backend "azurerm" {
    resource_group_name  = "recall-tfstate-rg"
    storage_account_name = "recalltfstate"
    container_name       = "tfstate"
  }
}
