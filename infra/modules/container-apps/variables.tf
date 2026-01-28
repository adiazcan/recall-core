variable "environment" {
  type        = string
  description = "Environment name (dev or prod)"
}

variable "location" {
  type        = string
  description = "Azure region"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group name"
}

variable "log_analytics_workspace_id" {
  type        = string
  description = "Log Analytics Workspace ID"
}

variable "app_insights_connection_string" {
  type        = string
  description = "Application Insights connection string"
}

variable "key_vault_id" {
  type        = string
  description = "Key Vault resource ID"
}

variable "storage_account_name" {
  type        = string
  description = "Storage account name"
}

variable "storage_queue_name" {
  type        = string
  description = "Queue name for enrichment"
}

variable "storage_blob_container_name" {
  type        = string
  description = "Blob container name for thumbnails"
}

variable "storage_connection_string_secret_id" {
  type        = string
  description = "Key Vault secret ID for storage connection string"
}

variable "documentdb_connection_string_secret_id" {
  type        = string
  description = "Key Vault secret ID for DocumentDB connection string"
}

variable "acr_login_server" {
  type        = string
  description = "ACR login server URL"
}

variable "container_registry_id" {
  type        = string
  description = "ACR resource ID for role assignments"
}

variable "api_image" {
  type        = string
  description = "API container image reference"
}

variable "enrichment_image" {
  type        = string
  description = "Enrichment container image reference"
}

variable "api_min_replicas" {
  type        = number
  description = "API minimum replicas"
  default     = 0
}

variable "api_max_replicas" {
  type        = number
  description = "API maximum replicas"
  default     = 3
}

variable "api_cpu" {
  type        = number
  description = "API container CPU"
  default     = 0.25
}

variable "api_memory" {
  type        = string
  description = "API container memory"
  default     = "0.5Gi"
}

variable "enrichment_cpu" {
  type        = number
  description = "Enrichment container CPU"
  default     = 0.5
}

variable "enrichment_memory" {
  type        = string
  description = "Enrichment container memory"
  default     = "1Gi"
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
}
