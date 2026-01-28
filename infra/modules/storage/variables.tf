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

variable "blob_container_name" {
  type        = string
  description = "Blob container name"
  default     = "thumbnails"
}

variable "queue_name" {
  type        = string
  description = "Queue name"
  default     = "enrichment-queue"
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
}
