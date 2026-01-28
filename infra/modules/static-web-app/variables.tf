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

variable "container_app_api_id" {
  type        = string
  description = "API container app ID"
}

variable "container_app_api_fqdn" {
  type        = string
  description = "API container app FQDN"
}

variable "sku_tier" {
  type        = string
  description = "Static Web App SKU tier"
  default     = "Standard"
  validation {
    condition     = var.sku_tier == "Standard"
    error_message = "Static Web App SKU must be Standard for linked backend support."
  }
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
}
