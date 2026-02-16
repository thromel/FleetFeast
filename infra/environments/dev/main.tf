module "environment_baseline" {
  source       = "../../modules/environment_baseline"
  environment  = var.environment
  aws_region   = var.aws_region
  project_name = var.project_name
  common_tags = {
    Repository = "FoodPanda"
    OwnerTeam  = "Platform"
  }
}

module "runtime_baseline" {
  source               = "../../modules/runtime_baseline"
  name_prefix          = module.environment_baseline.name_prefix
  aws_region           = var.aws_region
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
  core_api_port        = var.core_api_port
  dispatch_port        = var.dispatch_port
  common_tags          = module.environment_baseline.baseline_tags
}

module "security_baseline" {
  source                   = "../../modules/security_baseline"
  name_prefix              = module.environment_baseline.name_prefix
  common_tags              = module.environment_baseline.baseline_tags
  payment_provider_api_key = var.payment_provider_api_key
  maps_api_key             = var.maps_api_key
}

output "name_prefix" {
  value = module.environment_baseline.name_prefix
}

output "vpc_id" {
  value = module.runtime_baseline.vpc_id
}

output "alb_dns_name" {
  value = module.runtime_baseline.alb_dns_name
}

output "kms_key_arn" {
  value = module.security_baseline.kms_key_arn
}
