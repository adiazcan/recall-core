# Development environment configuration
environment = "dev"
location    = "swedencentral"
static_web_app_location = "westeurope"

# Container Registry (created via bootstrap script)
# Replace <subscription-id> with your actual Azure subscription ID
container_registry_id = "/subscriptions/<subscription-id>/resourceGroups/recall-shared-rg/providers/Microsoft.ContainerRegistry/registries/recallacr"

# Container images (set via workflow)
api_image        = "recallacr.azurecr.io/recall-api:latest"
enrichment_image = "recallacr.azurecr.io/recall-enrichment:latest"
