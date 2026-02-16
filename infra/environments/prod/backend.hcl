bucket         = "foodpanda-terraform-state-prod"
key            = "foundation/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "foodpanda-terraform-locks-prod"
encrypt        = true
