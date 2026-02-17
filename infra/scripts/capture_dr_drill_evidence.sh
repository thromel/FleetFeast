#!/usr/bin/env bash
set -euo pipefail

environment="staging"
scenario_id=""
rpo_minutes=""
rto_minutes=""
output_file=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment)
      environment="$2"
      shift 2
      ;;
    --scenario-id)
      scenario_id="$2"
      shift 2
      ;;
    --rpo-minutes)
      rpo_minutes="$2"
      shift 2
      ;;
    --rto-minutes)
      rto_minutes="$2"
      shift 2
      ;;
    --output)
      output_file="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 --scenario-id <id> --rpo-minutes <n> --rto-minutes <n> --output <file> [--environment <env>]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$scenario_id" || -z "$rpo_minutes" || -z "$rto_minutes" || -z "$output_file" ]]; then
  echo "Missing required arguments" >&2
  exit 1
fi

if ! [[ "$rpo_minutes" =~ ^[0-9]+$ && "$rto_minutes" =~ ^[0-9]+$ ]]; then
  echo "RPO/RTO values must be integer minutes" >&2
  exit 1
fi

release_gate_status="PASS"
if (( rpo_minutes > 15 || rto_minutes > 60 )); then
  release_gate_status="FAIL"
fi

generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "$output_file" <<REPORT
# DR Drill Evidence

- Generated At: $generated_at
- Environment: $environment
- Scenario ID: $scenario_id
- RPO Minutes: $rpo_minutes
- RTO Minutes: $rto_minutes
- Release Gate Status: $release_gate_status

## Control Objective

- RPO <= 15 minutes
- RTO <= 60 minutes
REPORT

echo "DR evidence captured: $output_file"
