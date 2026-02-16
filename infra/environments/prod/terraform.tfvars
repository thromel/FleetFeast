environment  = "prod"
aws_region   = "us-east-1"
project_name = "foodpanda"

vpc_cidr             = "10.30.0.0/16"
public_subnet_cidrs  = ["10.30.1.0/24", "10.30.2.0/24"]
private_subnet_cidrs = ["10.30.11.0/24", "10.30.12.0/24"]
availability_zones   = ["us-east-1a", "us-east-1b"]

core_api_port = 3000
dispatch_port = 8080

payment_provider_api_key = "REPLACE_PROD_PAYMENT_API_KEY"
maps_api_key             = "REPLACE_PROD_MAPS_API_KEY"
