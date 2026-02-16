bucket         = "foodpanda-terraform-state-staging"
key            = "foundation/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "foodpanda-terraform-locks-staging"
encrypt        = true
