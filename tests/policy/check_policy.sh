#!/usr/bin/env bash
set -euo pipefail

policy_file="infra/policy/iam-boundary.json"
[[ -f "$policy_file" ]]

rg -q '"Effect"\s*:\s*"Deny"' "$policy_file"
rg -q '"Sid"\s*:\s*"DenyIamMutationAndAccountTakeover"' "$policy_file"

echo "Policy checks passed"
