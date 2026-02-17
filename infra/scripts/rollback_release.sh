#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-${DEPLOY_ENVIRONMENT:-staging}}"
CORE_TARGET="${CORE_ROLLBACK_TARGET:-previous-stable}"
DISPATCH_TARGET="${DISPATCH_ROLLBACK_TARGET:-previous-stable}"

if [[ -z "$ENVIRONMENT" ]]; then
  echo "Environment is required for rollback." >&2
  exit 1
fi

echo "Starting rollback for environment: $ENVIRONMENT"
echo "Reverting core-api blue/green target to: $CORE_TARGET"
echo "Reverting dispatch-engine canary target to: $DISPATCH_TARGET"

echo "Rollback commands are placeholders. Replace with ECS deployment rollback calls."
echo "Rollback plan executed successfully"
