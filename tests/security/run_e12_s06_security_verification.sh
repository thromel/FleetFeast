#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CASES_FILE="$ROOT_DIR/tests/security/e12_s06_security_cases.json"
VALIDATOR="$ROOT_DIR/tests/security/validate_security_cases.mjs"
AUDIT_CHECKER="$ROOT_DIR/tests/security/check_audit_completeness.mjs"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

node "$VALIDATOR" "$CASES_FILE"

AUTHZ_TEST_FILES=()
while IFS= read -r test_file; do
  [[ -n "$test_file" ]] && AUTHZ_TEST_FILES+=("$test_file")
done < <(node -e "const c=require('$CASES_FILE'); for (const f of c.authz_boundaries.testFiles) console.log(f);")

AUDIT_ROUTE_TEST_FILES=()
while IFS= read -r test_file; do
  [[ -n "$test_file" ]] && AUDIT_ROUTE_TEST_FILES+=("$test_file")
done < <(node -e "const c=require('$CASES_FILE'); for (const f of c.audit_completeness.routeTestFiles) console.log(f);")
REQUIRED_ERROR_CODE="$(node -e "const c=require('$CASES_FILE'); process.stdout.write(c.authz_boundaries.requiredErrorCode);")"

if [[ $DRY_RUN -eq 1 ]]; then
  if ! rg -q "$REQUIRED_ERROR_CODE" "$ROOT_DIR/core-api/src/modules/identity/admin.route.authz.test.ts"; then
    echo "Missing required authz error code assertion in admin authz test source." >&2
    exit 1
  fi

  node "$AUDIT_CHECKER" "$CASES_FILE"
  echo "E12-S06 dry-run complete. Security verification configuration is valid."
  exit 0
fi

npm run build --prefix "$ROOT_DIR/core-api"

for test_file in "${AUTHZ_TEST_FILES[@]}" "${AUDIT_ROUTE_TEST_FILES[@]}"; do
  if [[ ! -f "$ROOT_DIR/$test_file" ]]; then
    echo "Missing compiled security test file: $ROOT_DIR/$test_file" >&2
    exit 1
  fi
done

node --test \
  "${AUTHZ_TEST_FILES[@]/#/$ROOT_DIR/}" \
  "${AUDIT_ROUTE_TEST_FILES[@]/#/$ROOT_DIR/}"

node "$AUDIT_CHECKER" "$CASES_FILE"

echo "E12-S06 security verification suite completed."
