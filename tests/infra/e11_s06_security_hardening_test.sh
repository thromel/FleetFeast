#!/usr/bin/env bash
set -euo pipefail

script="infra/scripts/run_security_hardening_audit.sh"
[[ -x "$script" ]] || {
  echo "Missing executable security audit script: $script" >&2
  exit 1
}

output_file="/tmp/foodpanda-security-audit.txt"
rm -f "$output_file"

"$script" --policy infra/policy/iam-boundary.json --report "$output_file"

[[ -f "$output_file" ]] || {
  echo "Expected security audit report file" >&2
  exit 1
}

rg -q "SECURITY_AUDIT_PASS" "$output_file" || {
  echo "Security audit did not pass" >&2
  exit 1
}
rg -q "least-privilege" "$output_file" || {
  echo "Security audit report missing least-privilege section" >&2
  exit 1
}

echo "E11-S06 security hardening checks passed"
