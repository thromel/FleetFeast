variable "name_prefix" {
  description = "Resource name prefix"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks"
  type        = list(string)
}

variable "availability_zones" {
  description = "Availability zones matching subnet CIDRs"
  type        = list(string)
}

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

variable "core_api_container_image" {
  description = "Container image for core-api"
  type        = string
  default     = "public.ecr.aws/docker/library/nginx:stable-alpine"
}

variable "dispatch_container_image" {
  description = "Container image for dispatch-engine"
  type        = string
  default     = "public.ecr.aws/docker/library/nginx:stable-alpine"
}

variable "core_api_port" {
  description = "Container port for core-api"
  type        = number
  default     = 3000
}

variable "dispatch_port" {
  description = "Container port for dispatch-engine"
  type        = number
  default     = 8080
}
