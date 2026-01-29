locals {
  common_tags = {
    project     = "recall-core"
    environment = var.environment
    managed_by  = "terraform"
  }
}

module "resource_group" {
  source      = "./modules/resource-group"
  environment = var.environment
  location    = var.location
  tags        = local.common_tags
}

module "monitoring" {
  source              = "./modules/monitoring"
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = local.common_tags
}

module "keyvault" {
  source              = "./modules/keyvault"
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = local.common_tags
}

module "storage" {
  source              = "./modules/storage"
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  tags                = local.common_tags
}

module "documentdb" {
  source              = "./modules/documentdb"
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  key_vault_id        = module.keyvault.id
  tags                = local.common_tags
}

module "container_apps" {
  source                                 = "./modules/container-apps"
  environment                            = var.environment
  location                               = var.location
  resource_group_name                    = module.resource_group.name
  log_analytics_workspace_id             = module.monitoring.log_analytics_workspace_id
  app_insights_connection_string         = module.monitoring.app_insights_connection_string
  key_vault_id                           = module.keyvault.id
  storage_account_name                   = module.storage.storage_account_name
  storage_account_id                     = module.storage.storage_account_id
  storage_connection_string              = module.storage.primary_connection_string
  storage_blob_endpoint                  = module.storage.primary_blob_endpoint
  storage_queue_name                     = module.storage.queue_name
  storage_blob_container_name            = module.storage.blob_container_name
  documentdb_connection_string_secret_id = module.documentdb.connection_string_secret_id
  acr_login_server                       = var.acr_login_server
  api_image                              = var.api_image
  enrichment_image                       = var.enrichment_image
  tags                                   = local.common_tags
}

module "static_web_app" {
  source                 = "./modules/static-web-app"
  environment            = var.environment
  location               = var.location
  resource_group_name    = module.resource_group.name
  container_app_api_id   = module.container_apps.api_id
  container_app_api_fqdn = module.container_apps.api_fqdn
  tags                   = local.common_tags
}
