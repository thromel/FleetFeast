# Production Deployment And Cost Estimates (AWS)

- Version: `1.0.0`
- Date: `2026-02-16`
- Region baseline: `us-east-1`
- Currency: `USD`
- Scope: infrastructure and platform operations for Balanced V1

## 1. Cost Model Principles

- This model is decision-support, not invoice-exact.
- All estimates are monthly and include a 15% contingency buffer unless stated.
- Prices are based on public AWS pricing pages and planning assumptions captured on `2026-02-16`.
- Third-party pass-through costs (payments, maps, messaging) are listed separately from AWS infrastructure target.

## 2. Deployment Topology By Environment

### 2.1 Environments

- `dev`: shared engineering environment, lower resilience settings
- `staging`: production-like pre-release and performance testing environment
- `prod`: hardened controls, HA data, full observability and compliance evidence

### 2.2 Core AWS Services

- Edge: CloudFront + WAF + ALB
- Compute: ECS Fargate (`core-api`, `dispatch-engine`, workers)
- Data: RDS PostgreSQL (Multi-AZ in prod), ElastiCache Redis, S3
- Messaging: EventBridge + SQS (+ DLQ)
- Security and operations: KMS, Secrets Manager, CloudWatch logs/metrics/alarms, backup and DR automation

## 3. Pricing Anchors Used

As of `February 16, 2026`, these baseline rates were used directly from AWS pricing pages:

- Fargate Linux x86 on-demand us-east-1:
  - vCPU: `$0.000011244` per second (`$0.0404784` per vCPU-hour)
  - Memory: `$0.000001235` per GB-second (`$0.004446` per GB-hour)
- ALB:
  - `$0.0225` per ALB-hour
  - `$0.008` per LCU-hour
- NAT Gateway:
  - `$0.045` per gateway-hour
  - `$0.045` per GB processed
- CloudFront pay-as-you-go (Price Class All, first 10 TB):
  - `$0.085` per GB for data transfer out to internet
- EventBridge:
  - `$1.00` per million events ingested
- Secrets Manager:
  - `$0.40` per secret per month
  - `$0.05` per 10,000 API calls

Assumption-driven rates (validate in calculator before commit):

- S3 Standard storage modeled at `$0.023` per GB-month
- RDS PostgreSQL and ElastiCache Redis instance costs are calculator-based planning assumptions
- CloudWatch ingestion, query, and retention costs modeled from observed GB/day assumptions

## 4. Workload And Sizing Assumptions

### 4.1 Traffic Assumptions

| Stage | MAU | Daily Orders (Peak Day) | Monthly Orders (Approx) |
|---|---:|---:|---:|
| Stage A (Dev/Staging baseline) | N/A | Synthetic load only | N/A |
| Stage B (Launch month) | 10,000 | 1,000 | 18,000 |
| Stage C (Month 12 growth) | 35,000 | 2,500 | 52,000 |

### 4.2 Core Compute Sizing

| Stage | `core-api` | `dispatch-engine` | Async Workers |
|---|---|---|---|
| Stage A | 2 tasks x (0.5 vCPU, 1 GB) | 1 task x (0.5 vCPU, 1 GB) | 2 tasks x (0.25 vCPU, 0.5 GB) |
| Stage B | 6 tasks x (1 vCPU, 2 GB) | 3 tasks x (1 vCPU, 2 GB) | 4 tasks x (0.5 vCPU, 1 GB) |
| Stage C | 12 tasks x (1 vCPU, 2 GB) | 6 tasks x (1 vCPU, 2 GB) | 8 tasks x (0.5 vCPU, 1 GB) |

### 4.3 Data Sizing

| Stage | PostgreSQL | Redis | S3 Active Data |
|---|---|---|---|
| Stage A | Single-AZ small | Single small node | 100 GB |
| Stage B | Multi-AZ medium | 2 medium nodes | 600 GB |
| Stage C | Multi-AZ larger + read replica | 3 medium nodes | 1.8 TB |

## 5. Three-Stage Monthly Cost Model

## 5.1 Stage A: Dev/Staging Baseline

| Cost Category | Estimate |
|---|---:|
| Fargate compute | $180 |
| ALB + NAT + data transfer | $260 |
| RDS PostgreSQL | $420 |
| Redis | $130 |
| S3 + CloudFront | $85 |
| EventBridge + SQS | $40 |
| Security (WAF, KMS, Secrets) | $130 |
| Observability (logs/metrics/traces/alerts) | $340 |
| Backup + DR tooling baseline | $95 |
| Subtotal | $1,680 |
| 15% contingency | $252 |
| Total Stage A | **$1,932** |

## 5.2 Stage B: Launch Month (Early Scale)

| Cost Category | Estimate |
|---|---:|
| Fargate compute | $780 |
| ALB + NAT + egress | $640 |
| RDS PostgreSQL (Multi-AZ) | $1,240 |
| Redis | $420 |
| S3 + CloudFront | $360 |
| EventBridge + SQS | $110 |
| Security (WAF, KMS, Secrets, policy checks) | $310 |
| Observability and on-call tooling | $1,020 |
| Backup + DR operations | $240 |
| Subtotal | $5,120 |
| 15% contingency | $768 |
| Total Stage B | **$5,888** |

Result: infrastructure remains below the `$8,000` monthly target.

## 5.3 Stage C: Month 12 Growth Scenario

| Cost Category | Estimate |
|---|---:|
| Fargate compute | $1,720 |
| ALB + NAT + egress | $1,020 |
| RDS PostgreSQL (larger + replica) | $2,040 |
| Redis | $760 |
| S3 + CloudFront | $820 |
| EventBridge + SQS | $260 |
| Security and compliance controls | $470 |
| Observability and incident tooling | $1,260 |
| Backup + DR operations | $430 |
| Subtotal | $8,780 |
| Optimization credits and reservations target | -$1,520 |
| Total Stage C (optimized) | **$7,260** |

Result: under `$8,000` target if optimization actions are implemented.

## 6. Fixed Vs Variable Cost Split

### 6.1 Stage B Split (Launch)

- Fixed-like monthly costs (base capacity, tooling, security baseline): `~$3,980` (`67.6%`)
- Variable costs (traffic/order-sensitive): `~$1,908` (`32.4%`)

### 6.2 Variable Cost Drivers

- CDN egress and NAT processed GB
- Event and queue throughput
- Notification send volume
- Maps/geocoding request volume
- Payment processor transaction volume

## 7. Traffic And Order Sensitivity

### 7.1 Infra Sensitivity Formula (Launch Baseline)

Approximate monthly infra cost:

`MonthlyInfra = BaseFixed + (Orders x VariablePerOrderInfra)`

Launch assumptions:

- `BaseFixed = $3,980`
- `VariablePerOrderInfra ~= $0.106`

Examples:

- `18,000` orders -> `$5,888`
- `25,000` orders -> `$6,630`
- `35,000` orders -> `$7,690`

### 7.2 Third-Party Pass-Through (Not Included In $8k Infra Target)

- Payment processing (illustrative): `2.9% + $0.30` per card transaction
- Maps/geocoding API calls: usage-based
- SMS/email/push providers: usage-based

At `18,000` monthly orders and average order value `$27`:

- illustrative payment fees can exceed `$19,000`/month
- this is operating cost of sales, separate from infrastructure budget guardrail

## 8. Enterprise Control Minimum Set Vs Deferable Hardening

### 8.1 Non-Negotiable Enterprise Control Minimum Set

- WAF enabled on internet-facing endpoints
- KMS encryption and managed key rotation
- Immutable audit log pipeline for financial/admin actions
- Secrets Manager for credentials and API keys
- MFA and least privilege for privileged users
- DR runbooks and periodic restore evidence
- Structured observability with security-grade retention for critical audit data

### 8.2 Deferable Hardening Set (Only If Budget Pressure)

- Multi-region active-active topology
- Dedicated SIEM beyond CloudWatch-native baseline
- Advanced anomaly detection add-ons beyond threshold-based alerting
- Non-critical long-tail trace retention beyond baseline SLA window

## 9. Scaling Triggers And Optimization Actions

### 9.1 Trigger Thresholds

- API CPU sustained `>60%` for 15 min -> scale out tasks
- P95 checkout latency `>700 ms` -> autoscale + query optimization
- DB CPU/IO sustained `>70%` -> tune indexes, then scale class
- Queue oldest message age `>120 sec` -> worker scale-out
- Monthly projected spend `>85%` of budget by day 20 -> activate cost controls

### 9.2 Cost Optimization Playbook

- Use Compute Savings Plans for stable baseline capacity
- Right-size idle staging workloads outside business hours
- Tune CloudWatch log retention and query windows
- Prefer S3 lifecycle transitions for old non-critical objects
- Use cache hit ratio targets to reduce DB and external API call volume
- Reduce NAT data processing through VPC endpoints where possible

## 10. Cost Validation And Governance

### 10.1 Validation Tests

- Reconcile model against AWS Pricing Calculator exports each month
- Target monthly estimation variance within `+/-15%`
- Validate unit economics (`infra per order`) against actual billing
- Alert on spend anomalies by service and environment

### 10.2 Required Dashboards

- Daily and MTD spend by service and environment
- Cost per order, cost per delivered order, and failed-order cost
- Security/compliance control cost trend
- Forecasted end-of-month spend and confidence band

## 11. Source Links

- [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/)
- [AWS Application Load Balancer pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
- [AWS NAT Gateway pricing](https://aws.amazon.com/vpc/pricing/)
- [AWS S3 pricing](https://aws.amazon.com/s3/pricing/)
- [AWS CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/)
- [AWS EventBridge pricing](https://aws.amazon.com/eventbridge/pricing/)
- [AWS Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/)

## 12. Decision Summary

- Stage B launch infra estimate: **$5,888/month**
- Stage C (month 12) optimized infra estimate: **$7,260/month**
- Budget target (`<$8,000/month infra`) is achievable with planned optimization controls.
