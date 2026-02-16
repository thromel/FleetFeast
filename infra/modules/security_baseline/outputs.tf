output "kms_key_arn" {
  description = "KMS key ARN used for secrets"
  value       = aws_kms_key.app_secrets.arn
}

output "payment_provider_secret_arn" {
  description = "Payment provider secret ARN"
  value       = aws_secretsmanager_secret.payment_provider_api_key.arn
}

output "maps_secret_arn" {
  description = "Maps API secret ARN"
  value       = aws_secretsmanager_secret.maps_api_key.arn
}
