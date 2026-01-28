variable "environment" {
  type        = string
  description = "Environment name (dev or prod)"
}

variable "location" {
  type        = string
  description = "Azure region"
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
}
