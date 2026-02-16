variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs"
  type        = list(string)
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
}

variable "core_api_port" {
  description = "core-api port"
  type        = number
}

variable "dispatch_port" {
  description = "dispatch-engine port"
  type        = number
}

variable "payment_provider_api_key" {
  description = "Payment provider API key"
  type        = string
  sensitive   = true
}

variable "maps_api_key" {
  description = "Maps API key"
  type        = string
  sensitive   = true
}
