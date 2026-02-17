#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-staging}"
DB_INSTANCE_ID="${2:-foodpanda-${ENVIRONMENT}-core-db}"
AWS_REGION="${3:-us-east-1}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi

backup_retention_days="$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].BackupRetentionPeriod' \
  --output text)"

earliest_restorable_time="$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].EarliestRestorableTime' \
  --output text)"

if [[ "$backup_retention_days" == "None" || "$backup_retention_days" == "null" ]]; then
  echo "BackupRetentionPeriod missing for $DB_INSTANCE_ID" >&2
  exit 1
fi

if (( backup_retention_days < 1 )); then
  echo "Backup retention must be at least 1 day, got: $backup_retention_days" >&2
  exit 1
fi

if [[ "$earliest_restorable_time" == "None" || "$earliest_restorable_time" == "null" ]]; then
  echo "EarliestRestorableTime missing; PITR appears unavailable for $DB_INSTANCE_ID" >&2
  exit 1
fi

echo "Backup/PITR verification passed"
echo "environment=$ENVIRONMENT db_instance_id=$DB_INSTANCE_ID region=$AWS_REGION"
echo "backup_retention_days=$backup_retention_days earliest_restorable_time=$earliest_restorable_time"
