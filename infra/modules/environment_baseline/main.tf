locals {
  normalized_project = lower(replace(var.project_name, " ", "-"))

  baseline_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.common_tags,
  )

  name_prefix = "${local.normalized_project}-${var.environment}"
}
