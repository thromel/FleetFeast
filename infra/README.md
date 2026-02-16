# Infrastructure Foundations

This directory contains Terraform-based environment foundations for the FoodPanda platform.

## Layout

- `environments/dev`: development stack entrypoint
- `environments/staging`: staging stack entrypoint
- `environments/prod`: production stack entrypoint
- `modules/environment_baseline`: reusable baseline module for shared tags and naming
- `policy/iam-boundary.json`: permission boundary policy scaffold
- `scripts/verify_env_foundation.sh`: local structural verification script

## Usage

Initialize and plan a specific environment from its directory:

```bash
cd infra/environments/dev
terraform init -backend-config=backend.hcl
terraform plan
```

Terraform CLI is required locally for full validation. This repository also includes static tests under `tests/infra` for environments where Terraform is unavailable.
