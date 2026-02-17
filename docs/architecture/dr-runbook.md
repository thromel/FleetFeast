# Disaster Recovery Runbook (E11-S04)

## Objectives

- `RPO <= 15 minutes` for order/payment/settlement records.
- `RTO <= 60 minutes` for consumer checkout and core orchestration APIs.

## Scope

- AWS managed Postgres (`RDS/Aurora`) backup and PITR verification.
- Regional failover drill for primary transactional database.
- Operational validation of API reachability and data consistency after failover.

## Preconditions

- On-call engineer and incident commander assigned.
- Latest infra and app changes deployed to `staging` or DR test environment.
- AWS credentials scoped to DR drill operations.

## Failover Steps

1. Confirm backup and PITR window availability via `infra/scripts/verify_backup_pitr.sh`.
2. Announce drill start in incident channel and record start timestamp.
3. Execute dry run for failover sequence:
   - `infra/scripts/run_dr_failover_drill.sh --env staging --dry-run`
4. Execute actual failover command (only in planned drill window):
   - `infra/scripts/run_dr_failover_drill.sh --env staging`
5. Validate writer endpoint promotion and application connectivity.
6. Run smoke checks for checkout, order creation, payment authorization/capture.
7. Capture `RTO` and data gap (`RPO`) evidence into incident record.

## Rollback Steps

1. Repoint app configuration to primary writer endpoint if failback is required.
2. Re-run smoke checks for checkout/payment/support flows.
3. Confirm alerting and dashboards have returned to baseline.

## Evidence Collection

- Backup/PITR verification output.
- Failover drill command logs with timestamps.
- Post-failover smoke check results.
- Computed RPO/RTO numbers and exceptions.
