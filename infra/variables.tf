variable "environment" {
  type        = string
  description = "Environment name (dev or prod)"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be dev or prod."
  }
}

variable "location" {
  type        = string
  description = "Azure region for all resources"
  default     = "swedencentral"
}

variable "static_web_app_location" {
  type        = string
  description = "Azure region for Static Web App"
  default     = "westeurope"
}

variable "acr_login_server" {
  type        = string
  description = "ACR login server URL"
  default     = "recallacr.azurecr.io"
}

variable "container_registry_id" {
  type        = string
  description = "ACR resource ID for role assignments"
}

variable "api_image" {
  type        = string
  description = "Full API container image reference"
}

variable "enrichment_image" {
  type        = string
  description = "Full enrichment container image reference"
}
