# Production environment configuration
environment = "prod"
location    = "swedencentral"

# Container Registry (created via bootstrap script)
container_registry_id = "/subscriptions/<subscription-id>/resourceGroups/recall-shared-rg/providers/Microsoft.ContainerRegistry/registries/recallacr"

# Container images (set via workflow)
api_image        = "recallacr.azurecr.io/recall-api:latest"
enrichment_image = "recallacr.azurecr.io/recall-enrichment:latest"
