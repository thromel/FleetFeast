variable "name_prefix" {
  description = "Resource name prefix"
  type        = string
}

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

variable "payment_provider_api_key" {
  description = "API key for payment provider integration"
  type        = string
  sensitive   = true
}

variable "maps_api_key" {
  description = "API key for maps/geocoding integration"
  type        = string
  sensitive   = true
}

variable "kms_deletion_window_in_days" {
  description = "KMS key deletion window"
  type        = number
  default     = 30
}
