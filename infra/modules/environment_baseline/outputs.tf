output "name_prefix" {
  description = "Standardized prefix for resource naming"
  value       = local.name_prefix
}

output "baseline_tags" {
  description = "Merged baseline tags for all resources"
  value       = local.baseline_tags
}
