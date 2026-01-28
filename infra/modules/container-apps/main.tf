data "azurerm_storage_account" "main" {
  name                = var.storage_account_name
  resource_group_name = var.resource_group_name
}

resource "azurerm_container_app_environment" "main" {
  name                = "recall-${var.environment}-cae"
  location            = var.location
  resource_group_name = var.resource_group_name

  log_analytics_workspace_id = var.log_analytics_workspace_id
  tags                       = var.tags
}

resource "azurerm_container_app_environment_dapr_component" "enrichment_pubsub" {
  name                         = "enrichment-pubsub"
  container_app_environment_id = azurerm_container_app_environment.main.id
  component_type               = "pubsub.azure.storagequeues"
  version                      = "v1"
  scopes                       = [azurerm_container_app.enrichment.name]

  metadata {
    name  = "accountName"
    value = var.storage_account_name
  }

  metadata {
    name  = "queueName"
    value = var.storage_queue_name
  }

  metadata {
    name        = "connectionString"
    secret_name = "storage-connection-string"
  }

  secret {
    name                = "storage-connection-string"
    identity            = "SystemAssigned"
    key_vault_secret_id = var.storage_connection_string_secret_id
  }
}

resource "azurerm_container_app" "api" {
  name                         = "recall-api-${var.environment}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type = "SystemAssigned"
  }

  registry {
    server   = var.acr_login_server
    identity = "SystemAssigned"
  }

  secret {
    name                = "documentdb-connection-string"
    identity            = "SystemAssigned"
    key_vault_secret_id = var.documentdb_connection_string_secret_id
  }

  secret {
    name                = "storage-connection-string"
    identity            = "SystemAssigned"
    key_vault_secret_id = var.storage_connection_string_secret_id
  }

  template {
    min_replicas = var.api_min_replicas
    max_replicas = var.api_max_replicas

    container {
      name   = "api"
      image  = var.api_image
      cpu    = var.api_cpu
      memory = var.api_memory

      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = var.app_insights_connection_string
      }

      env {
        name        = "ConnectionStrings__recalldb"
        secret_name = "documentdb-connection-string"
      }

      env {
        name        = "ConnectionStrings__blobs"
        secret_name = "storage-connection-string"
      }

      env {
        name  = "Storage__BlobEndpoint"
        value = data.azurerm_storage_account.main.primary_blob_endpoint
      }

      env {
        name  = "Storage__BlobContainerName"
        value = var.storage_blob_container_name
      }

      env {
        name  = "Enrichment__ThumbnailContainer"
        value = var.storage_blob_container_name
      }

      liveness_probe {
        transport = "HTTP"
        port      = 8080
        path      = "/health"
      }

      readiness_probe {
        transport = "HTTP"
        port      = 8080
        path      = "/health"
      }
    }
  }

  ingress {
    external_enabled           = true
    target_port                = 8080
    transport                  = "auto"
    allow_insecure_connections = false

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

resource "azurerm_container_app" "enrichment" {
  name                         = "recall-enrichment-${var.environment}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type = "SystemAssigned"
  }

  registry {
    server   = var.acr_login_server
    identity = "SystemAssigned"
  }

  secret {
    name                = "documentdb-connection-string"
    identity            = "SystemAssigned"
    key_vault_secret_id = var.documentdb_connection_string_secret_id
  }

  secret {
    name                = "storage-connection-string"
    identity            = "SystemAssigned"
    key_vault_secret_id = var.storage_connection_string_secret_id
  }

  dapr {
    app_id       = "recall-enrichment-${var.environment}"
    app_port     = 8080
    app_protocol = "http"
  }

  template {
    container {
      name   = "enrichment"
      image  = var.enrichment_image
      cpu    = var.enrichment_cpu
      memory = var.enrichment_memory

      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = var.app_insights_connection_string
      }

      env {
        name        = "ConnectionStrings__recalldb"
        secret_name = "documentdb-connection-string"
      }

      env {
        name        = "ConnectionStrings__blobs"
        secret_name = "storage-connection-string"
      }

      env {
        name  = "DAPR_PUBSUB_NAME"
        value = "enrichment-pubsub"
      }

      env {
        name  = "DAPR_PUBSUB_TOPIC"
        value = "enrichment.requested"
      }

      env {
        name  = "Storage__QueueName"
        value = var.storage_queue_name
      }

      env {
        name        = "Storage__QueueConnectionString"
        secret_name = "storage-connection-string"
      }
    }
  }
}
