#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CASES_FILE="$ROOT_DIR/tests/security/e12_s06_security_cases.json"
VALIDATOR="$ROOT_DIR/tests/security/validate_security_cases.mjs"
RUNNER="$ROOT_DIR/tests/security/run_e12_s06_security_verification.sh"

[[ -f "$CASES_FILE" ]] || {
  echo "Missing security cases file: $CASES_FILE" >&2
  exit 1
}

node "$VALIDATOR" "$CASES_FILE"
bash "$RUNNER" --dry-run

grep -q 'authz_boundaries' "$CASES_FILE"
grep -q 'audit_completeness' "$CASES_FILE"

echo "E12-S06 security verification suite checks passed."
