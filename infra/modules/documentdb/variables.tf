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

variable "key_vault_id" {
  type        = string
  description = "Key Vault resource ID"
}

variable "key_vault_rbac_ready" {
  type        = string
  description = "Dependency signal that Key Vault RBAC is configured"
  default     = null
}

variable "administrator_login" {
  type        = string
  description = "DocumentDB administrator username"
  default     = "recalladmin"
}

variable "database_name" {
  type        = string
  description = "Logical database name"
  default     = "recalldb"
}

variable "sku_tier" {
  type        = string
  description = "DocumentDB SKU tier"
  default     = "M25"
}

variable "storage_size_gb" {
  type        = number
  description = "Storage size in GB"
  default     = 32
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
}
