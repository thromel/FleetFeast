#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "docs/architecture/dr-runbook.md"
  "infra/scripts/verify_backup_pitr.sh"
  "infra/scripts/run_dr_failover_drill.sh"
)

for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || { echo "Missing DR artifact: $file" >&2; exit 1; }
done

rg -q "RPO <= 15 minutes" docs/architecture/dr-runbook.md || {
  echo "Runbook must include RPO objective" >&2
  exit 1
}
rg -q "RTO <= 60 minutes" docs/architecture/dr-runbook.md || {
  echo "Runbook must include RTO objective" >&2
  exit 1
}
rg -q "Failover Steps" docs/architecture/dr-runbook.md || {
  echo "Runbook must include failover procedure" >&2
  exit 1
}

for script in infra/scripts/verify_backup_pitr.sh infra/scripts/run_dr_failover_drill.sh; do
  rg -q "set -euo pipefail" "$script" || {
    echo "Script must enable strict mode: $script" >&2
    exit 1
  }
  [[ -x "$script" ]] || { echo "Script must be executable: $script" >&2; exit 1; }
done

rg -q "EarliestRestorableTime" infra/scripts/verify_backup_pitr.sh || {
  echo "Backup verification script must inspect PITR window" >&2
  exit 1
}

rg -q -- "--dry-run" infra/scripts/run_dr_failover_drill.sh || {
  echo "DR failover script must support dry-run mode" >&2
  exit 1
}

echo "E11-S04 DR backup/PITR and failover automation checks passed"
