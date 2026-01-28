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

variable "retention_days" {
  type        = number
  description = "Log retention in days"
  default     = 30
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
}
