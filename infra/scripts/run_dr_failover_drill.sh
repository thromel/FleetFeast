#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="staging"
AWS_REGION="us-east-1"
DB_CLUSTER_ID=""
DRY_RUN=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --db-cluster-id)
      DB_CLUSTER_ID="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --execute)
      DRY_RUN=false
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--env <env>] [--region <region>] [--db-cluster-id <id>] [--dry-run|--execute]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$DB_CLUSTER_ID" ]]; then
  DB_CLUSTER_ID="foodpanda-${ENVIRONMENT}-core-cluster"
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi

declare -a commands=(
  "aws rds describe-db-clusters --db-cluster-identifier '$DB_CLUSTER_ID' --region '$AWS_REGION'"
  "aws rds failover-db-cluster --db-cluster-identifier '$DB_CLUSTER_ID' --region '$AWS_REGION'"
  "aws rds describe-db-clusters --db-cluster-identifier '$DB_CLUSTER_ID' --region '$AWS_REGION' --query 'DBClusters[0].DBClusterMembers'"
)

echo "Starting DR failover drill"
echo "environment=$ENVIRONMENT region=$AWS_REGION cluster=$DB_CLUSTER_ID dry_run=$DRY_RUN"

for cmd in "${commands[@]}"; do
  echo "[dr-step] $cmd"
  if [[ "$DRY_RUN" == false ]]; then
    eval "$cmd"
  fi
done

echo "DR failover drill completed"
