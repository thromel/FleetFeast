variable "environment" {
  description = "Environment name"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
}

variable "project_name" {
  description = "Project identifier for resource naming and tags"
  type        = string
}

variable "common_tags" {
  description = "Common tags merged onto all resources"
  type        = map(string)
  default     = {}
}
