locals {
  tags = merge(
    {
      ManagedBy = "terraform"
      Service   = "security-baseline"
    },
    var.common_tags,
  )
}

resource "aws_kms_key" "app_secrets" {
  description             = "KMS key for ${var.name_prefix} secrets"
  deletion_window_in_days = var.kms_deletion_window_in_days
  enable_key_rotation     = true

  tags = merge(local.tags, { Name = "${var.name_prefix}-secrets-kms" })
}

resource "aws_kms_alias" "app_secrets" {
  name          = "alias/${var.name_prefix}-secrets"
  target_key_id = aws_kms_key.app_secrets.key_id
}

resource "aws_secretsmanager_secret" "payment_provider_api_key" {
  name        = "${var.name_prefix}/payments/provider_api_key"
  description = "Payment provider API key"
  kms_key_id  = aws_kms_key.app_secrets.arn

  recovery_window_in_days = 7

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "payment_provider_api_key" {
  secret_id     = aws_secretsmanager_secret.payment_provider_api_key.id
  secret_string = var.payment_provider_api_key
}

resource "aws_secretsmanager_secret" "maps_api_key" {
  name        = "${var.name_prefix}/maps/api_key"
  description = "Maps provider API key"
  kms_key_id  = aws_kms_key.app_secrets.arn

  recovery_window_in_days = 7

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "maps_api_key" {
  secret_id     = aws_secretsmanager_secret.maps_api_key.id
  secret_string = var.maps_api_key
}
