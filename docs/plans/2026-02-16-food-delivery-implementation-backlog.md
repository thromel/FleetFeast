# Food Delivery Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a production-ready, Balanced V1 food delivery platform for a US single-metro launch with enterprise-grade controls and an infrastructure budget target below $8k/month.

**Architecture:** Build a modular TypeScript core service for most bounded contexts and a selective Go dispatch service for real-time matching/telemetry, integrated through versioned APIs and domain events. Deploy on AWS managed infrastructure with strict security, observability, DR, and contract-testing gates from the start.

**Tech Stack:** TypeScript/Node.js, Go, PostgreSQL, Redis, ECS Fargate, EventBridge, SQS, S3, CloudFront, WAF, ALB, OpenTelemetry, IaC (Terraform), CI/CD (GitHub Actions).

## 1. Backlog Scope And Conventions

- Scope source of truth:
  - `/Users/romel/Documents/GitHub/FoodPanda/docs/requirements/functional-requirements-ddd.md`
  - `/Users/romel/Documents/GitHub/FoodPanda/docs/architecture/system-architecture-v1.md`
  - `/Users/romel/Documents/GitHub/FoodPanda/docs/architecture/api-and-event-contracts-v1.md`
- Team model: lean cross-functional team (6-10).
- Sprint cadence: 2 weeks.
- Priorities:
  - `P0`: launch-critical, blocks go-live.
  - `P1`: required for Balanced V1 but can follow core launch path.
  - `P2`: post-launch hardening/optimization.
- Estimation: story points (SP), Fibonacci (`1, 2, 3, 5, 8, 13`).

## 2. Definition Of Ready And Done

### Definition Of Ready

A story is ready when:

- FR IDs are linked.
- API/event contract impacts are identified.
- Acceptance criteria are testable.
- Dependencies are resolved or explicitly sequenced.
- Security/privacy implications are documented.

### Definition Of Done

A story is done when:

- Implementation merged.
- Unit/integration/contract tests pass.
- Observability signals added (logs/metrics/traces).
- Runbook and docs updated.
- Security checks and policy gates pass.
- FR traceability matrix row updated.

## 3. Milestones

- `M0`: Platform foundation and delivery pipeline ready.
- `M1`: Catalog + consumer ordering + quotes working end to end.
- `M2`: Order orchestration + dispatch + courier telemetry working.
- `M3`: Payments (cashless + cash) + refunds + settlement + payouts working.
- `M4`: Support, risk/compliance, notifications, and operational controls complete.
- `M5`: Performance, DR, security, and go-live readiness complete.

## 4. Epic Backlog

## Epic E01: Platform Foundation And Delivery Pipeline

**Objective:** Stand up baseline infrastructure, CI/CD, environment isolation, and engineering guardrails.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E01-S01 | Create mono-repo structure for `core-api`, `dispatch-engine`, shared contracts | P0 | 3 | None | FR-PLATFORM-008 |
| E01-S02 | Provision `dev/staging/prod` AWS accounts or isolated environments via Terraform | P0 | 8 | E01-S01 | FR-PLATFORM-008 |
| E01-S03 | Provision ECS Fargate, ALB, CloudFront, WAF, VPC networking baseline | P0 | 8 | E01-S02 | FR-PLATFORM-001, FR-PLATFORM-002 |
| E01-S04 | Configure CI/CD pipeline with build, test, security, and deploy gates | P0 | 8 | E01-S01 | FR-PLATFORM-003, FR-PLATFORM-008 |
| E01-S05 | Implement secrets and key management baseline (KMS + Secrets Manager) | P0 | 5 | E01-S02 | FR-PLATFORM-003 |
| E01-S06 | Implement release strategies: blue/green for core, canary for dispatch | P1 | 5 | E01-S03, E01-S04 | FR-PLATFORM-001 |

### Task Checklist

1. Create Terraform modules for network, compute, data, observability.
2. Create deployment templates for `core-api` and `dispatch-engine`.
3. Add CI checks: lint, unit, integration, contract, IaC policy, SAST.
4. Add environment protection rules and promotion workflow.
5. Create rollback runbook and smoke-test script.

## Epic E02: Identity, AuthN, AuthZ, And Privileged Access

**Objective:** Implement secure actor identity lifecycle and least-privilege enforcement.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E02-S01 | Implement user registration and identity model | P0 | 5 | E01-S03 | FR-IDENTITY-001 |
| E02-S02 | Implement JWT session issuance with rotating refresh tokens | P0 | 8 | E02-S01 | FR-IDENTITY-002 |
| E02-S03 | Implement RBAC policy engine and middleware | P0 | 8 | E02-S02 | FR-IDENTITY-003 |
| E02-S04 | Enforce MFA for privileged roles | P0 | 5 | E02-S03 | FR-IDENTITY-004 |
| E02-S05 | Implement admin break-glass flow with mandatory reason code and audit log | P1 | 5 | E02-S04 | FR-PLATFORM-006, FR-RISKCOMPLIANCE-004 |

### Task Checklist

1. Define role model for consumer, courier, merchant, support, finance, admin.
2. Build auth middleware package and permission decorators.
3. Add policy denial reason codes to API error schema.
4. Add security test suite for token replay, privilege escalation, and MFA bypass.

## Epic E03: Merchant Catalog And Store Operations

**Objective:** Enable merchant onboarding, menu publishing, inventory toggling, and store availability.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E03-S01 | Implement menu CRUD with version history | P0 | 8 | E02-S03 | FR-MERCHANTCATALOG-001 |
| E03-S02 | Implement store schedule and pause/unpause controls | P0 | 5 | E03-S01 | FR-MERCHANTCATALOG-002 |
| E03-S03 | Implement prep-time estimator endpoint for dispatch | P1 | 3 | E03-S01 | FR-MERCHANTCATALOG-003 |
| E03-S04 | Implement item stock/availability toggles | P0 | 3 | E03-S01 | FR-MERCHANTCATALOG-004 |
| E03-S05 | Build merchant portal flows for catalog and order operations | P1 | 8 | E03-S01, E03-S02 | FR-MERCHANTCATALOG-001, FR-MERCHANTCATALOG-002 |

### Task Checklist

1. Define catalog aggregate and versioning schema.
2. Expose merchant APIs from `/api/v1/merchant/*`.
3. Add cache invalidation strategy for catalog updates.
4. Add contract tests for menu payload compatibility.

## Epic E04: Consumer Discovery, Basket, Quote, And Checkout

**Objective:** Deliver consumer ordering experience from browse to order submission.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E04-S01 | Implement basket lifecycle and modifiers | P0 | 8 | E03-S01 | FR-CONSUMERORDERING-001 |
| E04-S02 | Implement delivery-zone serviceability validation | P0 | 5 | E04-S01 | FR-CONSUMERORDERING-002 |
| E04-S03 | Implement quote engine (fees, taxes, promos) | P0 | 13 | E04-S02 | FR-PRICINGPROMOTIONS-001, FR-PRICINGPROMOTIONS-002 |
| E04-S04 | Implement checkout payload with quote snapshot hash | P0 | 5 | E04-S03 | FR-CONSUMERORDERING-003 |
| E04-S05 | Implement consumer order timeline read model | P1 | 5 | E05-S03 | FR-CONSUMERORDERING-004, FR-ORDERORCHESTRATION-005 |

### Task Checklist

1. Implement `/api/v1/consumer/baskets`, `/quotes`, `/checkout` endpoints.
2. Integrate maps/geocoding adapter through anti-corruption layer.
3. Add pricing trace persistence and support replay view.
4. Add tests for stale quotes, out-of-zone addresses, and promo conflicts.

## Epic E05: Order Orchestration And State Machine

**Objective:** Build resilient order aggregate lifecycle and compensation logic.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E05-S01 | Implement order aggregate and state transition guardrails | P0 | 13 | E04-S04 | FR-ORDERORCHESTRATION-001 |
| E05-S02 | Implement merchant decision timeout and auto-cancel compensation | P0 | 8 | E05-S01 | FR-ORDERORCHESTRATION-002 |
| E05-S03 | Implement dispatch request saga integration | P0 | 8 | E05-S01, E06-S02 | FR-ORDERORCHESTRATION-003 |
| E05-S04 | Implement cancellation policy matrix by actor and order state | P0 | 5 | E05-S01 | FR-ORDERORCHESTRATION-004 |
| E05-S05 | Implement immutable order timeline projection and rebuild tooling | P1 | 8 | E05-S01 | FR-ORDERORCHESTRATION-005 |

### Task Checklist

1. Implement order domain events (`order.created.v1`, `order.cancelled.v1`, etc.).
2. Add outbox + idempotent consumer infrastructure.
3. Add saga timeout/retry policies with DLQ integration.
4. Add timeline rebuild command and operational runbook.

## Epic E06: Dispatch Service And Courier Telemetry

**Objective:** Deliver real-time assignment and route/ETA management with hybrid fleet support.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E06-S01 | Stand up Go `dispatch-engine` service skeleton and gRPC contracts | P0 | 5 | E01-S03, E01-S04 | FR-DISPATCH-001 |
| E06-S02 | Implement candidate scoring and assignment API | P0 | 13 | E06-S01, E03-S03 | FR-DISPATCH-001, FR-DISPATCH-002 |
| E06-S03 | Implement reassignment on decline/timeout/no-show | P0 | 8 | E06-S02 | FR-DISPATCH-003 |
| E06-S04 | Implement courier telemetry ingest and ETA updates | P0 | 8 | E06-S02 | FR-DISPATCH-004 |
| E06-S05 | Implement courier capacity/legal rest rules | P1 | 5 | E06-S02 | FR-DISPATCH-005 |
| E06-S06 | Implement merchant self-delivery fallback policy | P1 | 5 | E06-S02 | FR-DISPATCH-002 |

### Task Checklist

1. Define protobuf contracts and compatibility tests.
2. Build matching algorithm abstraction with fallback rules engine.
3. Add telemetry rate limits, ordering checks, and backpressure queueing.
4. Add assignment explainability fields (`score`, `reasonCodes`).

## Epic E07: Payments (Cashless + Cash) And Refunds

**Objective:** Implement payment orchestration with PSP abstraction and COD workflows.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E07-S01 | Implement `PaymentIntent` model and PSP adapter | P0 | 8 | E05-S01 | FR-PAYMENTS-001 |
| E07-S02 | Implement authorization and capture sequencing with idempotency | P0 | 8 | E07-S01, E05-S02 | FR-PAYMENTS-001, FR-PAYMENTS-002 |
| E07-S03 | Implement COD expected-vs-collected tracking | P0 | 5 | E05-S03, E06-S04 | FR-PAYMENTS-003 |
| E07-S04 | Implement partial/full refund workflows and approvals | P0 | 8 | E07-S02, E10-S02 | FR-PAYMENTS-004 |
| E07-S05 | Implement immutable payment audit trail | P0 | 5 | E07-S02 | FR-PAYMENTS-005, FR-RISKCOMPLIANCE-004 |

### Task Checklist

1. Build anti-corruption mapping for PSP request/response objects.
2. Add idempotency key enforcement to payment/refund endpoints.
3. Add finance/support visibility for payment state transitions.
4. Add failure-mode tests for auth timeout, capture failure, and duplicate callbacks.

## Epic E08: Settlement, Ledger, And Payouts

**Objective:** Build financial closure pipeline with reconciled payouts.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E08-S01 | Implement double-entry settlement ledger | P0 | 13 | E07-S02 | FR-SETTLEMENT-001 |
| E08-S02 | Implement payout batch generation scheduler | P0 | 8 | E08-S01 | FR-SETTLEMENT-002 |
| E08-S03 | Implement processor settlement-file reconciliation | P1 | 8 | E08-S01 | FR-SETTLEMENT-003 |
| E08-S04 | Publish merchant/courier payout statements | P1 | 5 | E08-S02 | FR-SETTLEMENT-004 |

### Task Checklist

1. Define ledger posting rules for captures, refunds, fees, and adjustments.
2. Implement exception queues for imbalance and payout holds.
3. Add reconciliation dashboard data model.
4. Add end-to-end ledger balancing tests.

## Epic E09: Notifications And Communication

**Objective:** Deliver reliable multi-channel messaging for lifecycle events and support workflows.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E09-S01 | Implement event-driven notification fanout workers | P0 | 8 | E05-S01, E01-S03 | FR-NOTIFICATIONS-001 |
| E09-S02 | Implement template and locale resolution | P1 | 5 | E09-S01 | FR-NOTIFICATIONS-002 |
| E09-S03 | Implement retry policy with DLQ | P0 | 5 | E09-S01 | FR-NOTIFICATIONS-003 |
| E09-S04 | Persist delivery receipts for support/compliance | P1 | 3 | E09-S01 | FR-NOTIFICATIONS-004 |

### Task Checklist

1. Add notification event subscription map.
2. Add provider adapters (push, SMS, email) with anti-corruption layer.
3. Add receipt persistence and query API for support timeline.
4. Add provider outage simulation tests.

## Epic E10: Support Operations, Risk, And Compliance

**Objective:** Enable support tooling, policy-driven interventions, and risk review pipelines.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E10-S01 | Implement ticketing model and timeline correlation view | P0 | 8 | E05-S05, E07-S05 | FR-SUPPORT-001, FR-SUPPORT-002 |
| E10-S02 | Implement intervention workflows (cancel, refund, reassignment) | P0 | 8 | E10-S01 | FR-SUPPORT-003 |
| E10-S03 | Implement SLA timers and escalation routing | P1 | 5 | E10-S01 | FR-SUPPORT-004 |
| E10-S04 | Implement risk policy engine and decision API | P0 | 8 | E02-S03, E05-S01 | FR-RISKCOMPLIANCE-002 |
| E10-S05 | Implement manual review workflow for high-risk refunds/payouts | P0 | 5 | E10-S04, E07-S04, E08-S02 | FR-RISKCOMPLIANCE-003 |
| E10-S06 | Implement immutable compliance audit pipeline and evidence jobs | P0 | 8 | E10-S04 | FR-RISKCOMPLIANCE-004, FR-PLATFORM-007 |

### Task Checklist

1. Build support/admin API namespace and role policies.
2. Add reason-code enforcement for privileged interventions.
3. Add manual review queue and reviewer decision trace.
4. Add compliance evidence export jobs and retention policy.

## Epic E11: Observability, SRE, Security, And DR

**Objective:** Ensure platform reliability and enterprise-grade operational readiness.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E11-S01 | Implement OpenTelemetry tracing and structured log schema | P0 | 8 | E01-S04 | FR-PLATFORM-005 |
| E11-S02 | Implement SLO dashboards and alerting policies | P0 | 5 | E11-S01 | FR-PLATFORM-001, FR-PLATFORM-002 |
| E11-S03 | Implement immutable audit write-failure critical alerts | P0 | 3 | E11-S01 | FR-PLATFORM-006 |
| E11-S04 | Implement backup/PITR and DR failover runbooks + automation | P0 | 8 | E01-S03 | FR-PLATFORM-004 |
| E11-S05 | Run DR drill and capture evidence for release gate | P0 | 5 | E11-S04 | FR-PLATFORM-004, FR-PLATFORM-007 |
| E11-S06 | Implement security hardening checks and IAM least-privilege audits | P1 | 5 | E02-S04, E01-S05 | FR-PLATFORM-003 |

### Task Checklist

1. Create service-level dashboards for API, queue, and DB.
2. Define incident severity matrix and on-call routing.
3. Automate DR evidence checks in CI release gates.
4. Add recurring access-review and secret-rotation jobs.

## Epic E12: Contract Quality, Performance, And Go-Live

**Objective:** Verify quality gates and execute controlled launch.

| Story ID | Story | Priority | SP | Dependencies | FR IDs |
|---|---|---:|---:|---|---|
| E12-S01 | Implement REST contract compatibility test suite | P0 | 5 | E04-S04, E05-S01 | FR-PLATFORM-008 |
| E12-S02 | Implement gRPC/protobuf compatibility test suite | P0 | 3 | E06-S01 | FR-DISPATCH-001 |
| E12-S03 | Implement event schema compatibility and idempotency replay tests | P0 | 5 | E05-S01 | FR-ORDERORCHESTRATION-005 |
| E12-S04 | Execute load testing at early-scale peak assumptions | P0 | 8 | E11-S02 | FR-PLATFORM-001, FR-PLATFORM-002 |
| E12-S05 | Execute failure injection suite (queue lag, DB failover, provider outages) | P0 | 8 | E11-S04 | FR-PLATFORM-004 |
| E12-S06 | Execute security verification suite (authz boundaries, audit completeness) | P0 | 5 | E11-S06 | FR-PLATFORM-003, FR-PLATFORM-006 |
| E12-S07 | Validate monthly cost model against observed usage and set anomaly alarms | P1 | 3 | E11-S02 | FR-PLATFORM-007 |
| E12-S08 | Launch readiness review and production go-live checklist | P0 | 5 | All prior P0 stories | FR-PLATFORM-001 |

### Task Checklist

1. Create release candidate scorecard (quality/security/perf/cost).
2. Define launch rollback and communication plan.
3. Run staged launch: internal, limited beta, full metro.
4. Freeze and document known issues accepted for launch.

## 5. Dependency-Critical Path

1. `E01` foundation and CI/CD gates.
2. `E02` identity/access.
3. `E03` catalog + `E04` consumer checkout path.
4. `E05` orchestration.
5. `E06` dispatch.
6. `E07` payments.
7. `E08` settlement.
8. `E10` support/risk/compliance.
9. `E11` SRE/DR gates.
10. `E12` validation and go-live.

## 6. Sprint Wave Plan (Initial)

### Wave 0 (Sprints 1-2): Foundation

- E01-S01 through E01-S05
- E02-S01 and E02-S02

Exit criteria:

- Environments deployable.
- CI/CD gates active.
- Auth baseline operational.

### Wave 1 (Sprints 3-4): Ordering Foundations

- E03-S01 through E03-S04
- E04-S01 through E04-S04
- E05-S01

Exit criteria:

- Consumer can place a test order to `CREATED` state.

### Wave 2 (Sprints 5-6): Fulfillment

- E05-S02 through E05-S04
- E06-S01 through E06-S04
- E09-S01 and E09-S03

Exit criteria:

- End-to-end assigned delivery flow in staging.

### Wave 3 (Sprints 7-8): Financial Closure

- E07-S01 through E07-S05
- E08-S01 through E08-S03
- E10-S01 and E10-S02

Exit criteria:

- Card + COD + refund + ledger integration complete.

### Wave 4 (Sprints 9-10): Operations And Launch Readiness

- E08-S04
- E09-S02 and E09-S04
- E10-S03 through E10-S06
- E11 all stories
- E12 all stories

Exit criteria:

- DR, security, performance, and go-live gates passed.

## 7. Immediate Next Sprint Candidate (Sprint 1)

Priority shortlist:

1. E01-S01
2. E01-S02
3. E01-S04
4. E02-S01
5. E02-S02

Sprint goal:

- Deployable baseline in `dev` with auth and CI/CD quality gates.

## 8. Tracking Views For Jira/Linear

Create these saved views:

- `Launch P0`: all `P0` stories not done.
- `By Context`: grouped by FR context (`IDENTITY`, `DISPATCH`, etc.).
- `Blocking Chain`: stories with unresolved dependencies.
- `Go-Live Gates`: E11 and E12 stories.
- `Cost Risk`: stories impacting spend profile (E01, E11, E12-S07).

## 9. Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Dispatch complexity delays orchestration milestones | Launch slips | Deliver rules fallback before optimization scoring |
| Payment provider integration instability | Refund and capture failures | Build adapter mocks and replay-safe idempotent flows early |
| Observability gaps hide production issues | Incident MTTR increases | Make telemetry instrumentation a Definition of Done gate |
| DR evidence missing near launch | Compliance and reliability risk | Automate DR evidence checks by Sprint 6 |
| Budget drift from logs/egress | Infra target exceeded | Add early spend anomaly alerts and retention guardrails |

## 10. Backlog Acceptance Criteria

Backlog is accepted when:

- every P0 story maps to at least one `FR-*` requirement,
- dependency chain is explicit and executable,
- sprint wave plan has measurable exit criteria,
- release-quality, security, DR, and cost validation stories are included,
- team can start Sprint 1 without additional architecture decisions.

## 11. Backend Implementation Progress (Live Tracker)

Last updated: `2026-02-18`

### 11.1 Epic Status Snapshot (Backend Features)

| Epic | Backend Status | Notes |
|---|---|---|
| E02 Identity/AuthZ | Done | Registration, sessions, RBAC, MFA, break-glass implemented and tested |
| E03 Merchant Catalog | Done | Menu versioning, availability, store status, prep-time endpoints implemented |
| E04 Consumer Ordering | Done | Basket, zones, quotes, checkout, consumer order endpoints implemented |
| E05 Order Orchestration | Done | State machine, cancellation matrix, dispatch request flow, timeline + rebuild implemented |
| E06 Dispatch | Done | Go dispatch scoring/assign/reassign/telemetry implemented; core orchestration now supports dispatch assignment through gRPC client contracts |
| E07 Payments | Done | Auth/capture/COD/refunds/audit flows implemented |
| E08 Settlement/Payouts | Done | Ledger, payout batches/schedules/statements, reconciliation run/history, CSV ingest, and scheduled import pipeline implemented |
| E09 Notifications | Done | Fanout, templates/locale, retry+DLQ, receipts implemented |
| E10 Support/Risk/Compliance | Done | Tickets, interventions, SLA escalation, policy engine, manual reviews, compliance audit implemented |
| E11 Observability/SRE | Done | Tracing/logging + durable persistence implemented; DR automation, DR evidence capture, and security hardening audit gates are in place and passing |

### 11.2 Recent Backend Delivery Log

| Commit | Story Mapping | Outcome |
|---|---|---|
| `34b0438` | E08-S03 | Added scheduled settlement reconciliation import path with idempotent runs and persistence coverage |
| `fefc707` | E06-S02 / E05-S03 | Added core dispatch orchestration path with injectable gRPC assignment client and route coverage |
| `8fe4b9f` | E08-S03 | Added settlement reconciliation CSV ingest endpoint with payload validation and test coverage |
| `c8f98d0` | E08-S03 | Added reconciliation summary counters for dashboard-friendly API responses |
| `3e1180f` | E11-S01 | Added persistent structured log repository and restart durability coverage |
| `8f96f84` | E08-S03 | Added reconciliation history filter by exception state |
| `578dbd4` | E08-S03 | Persisted reconciliation runs and added results API |
| `61147b2` | E05-S05 | Hydrated durable outbox for timeline rebuild reliability |
| `b154e83` | E08-S03 | Exposed reconciliation run API |
| `8657d13` | E10-S04 | Made risk policy rules configurable and persistent |
| `4610780` | E05-S05 | Persisted order timeline projection across restarts |
| `a4e3f92` | E09-S01 / E09-S04 | Persisted notification fanout and receipts |
| `e6f4895` | E08-S04 | Persisted payout statements across restarts |
| `528d3af` | E10-S06 | Persisted compliance audit logs across restarts |
| `6373946` | E10-S03 | Persisted support SLA escalation state |
| `323203a` | E10-S01 | Persisted support tickets across restarts |
| `db03dcf` | E10-S05 | Persisted manual review workflow state |
| `633529b` | E08-S02 | Persisted payout schedule idempotency state |
| `78b0c74` | E07-* | Persisted payment intents/refunds/audit artifacts |
| `51e4e68` | Cross-cutting | Added pluggable persistent stores and broker adapters |

### 11.3 Next Backend Features Queue

1. No open backend features remain in the current Balanced V1 backlog scope.

## 12. App Layer Implementation Progress (Live Tracker)

Last updated: `2026-02-18`

### 12.1 Story Status Snapshot (App Architecture V1)

| Story | Status | Notes |
|---|---|---|
| A01 Monorepo app foundation (`packages/shared-contracts`, `packages/geo-abstraction`, `packages/design-tokens`) | Done | Workspace scaffolding complete with tests and typed contracts |
| A02 Persona BFF services + realtime gateway skeleton | Done | `consumer-bff`, `courier-bff`, `ops-bff`, and `realtime-gateway` implemented with route-level tests |
| A03 BFF-to-core backend connectivity | Done | Core API adapters implemented in all three BFFs with test coverage against backend HTTP stubs |
| A04 App runtime bootstrap for BFF services | Done | `main.ts` entrypoints and `start` scripts added for local runtime |
| A05 Mobile/web app surfaces (native + Next.js) | In progress | Next.js `web-merchant` and `web-admin` apps implemented with live ops-bff integration; mobile surfaces pending |
| A06 OIDC+PKCE and app-session exchange hardening | Done | Added shared OIDC verifier (JWKS + dev fallback), persona-aware role checks, rotating refresh tokens, replay detection, and device-bound refresh validation across all BFFs |
| A07 Push fallback (APNs/FCM) and full realtime fanout | In progress | Realtime gateway now supports push registration/unregistration and fallback notification dispatch when no active socket; provider-specific adapters still pending |

### 12.2 Recent App Delivery Log

| Commit | Story Mapping | Outcome |
|---|---|---|
| `1d039fd` | A07 | Added realtime-gateway push fallback registration and dispatch baseline with websocket-vs-push behavior tests |
| `3bead32` | A06 | Added shared `app-auth` package and hardened BFF session exchange/refresh flows with replay and device-binding tests |
| `0a955fa` | A05 | Added runnable Next.js merchant/admin apps with typed API clients and tests |
| `7cb1032` | A02 | Added persona BFF server implementations and realtime gateway baseline with green tests |
| `8386a50` | A01 | Added shared contracts and geo abstraction packages with initial test coverage |

### 12.3 Verification Evidence (Current Slice)

1. `npm run test:app-layer` passes across shared packages, BFFs, and realtime gateway.
2. Live integration validation executed by running `core-api` with BFF servers and asserting:
   - consumer order read through `/app/v1/consumer/orders/{orderId}`
   - courier availability read through `/app/v1/courier/jobs/available`
   - merchant orders and admin incidents through `/app/v1/merchant/orders` and `/app/v1/admin/incidents`
3. App-session auth hardening validated with BFF route tests for:
   - OIDC session exchange via `/app/v1/{persona}/session/exchange`
   - rotating refresh via `/app/v1/{persona}/session/refresh`
   - replay and device-binding enforcement
4. Runnable web stack validation executed using `npm run dev:web-stack` with successful checks for:
   - `http://127.0.0.1:3001` merchant UI
   - `http://127.0.0.1:3002` admin UI
   - `http://127.0.0.1:3000/health` core-api health
5. Realtime push fallback baseline validated via gateway tests for:
   - fallback delivery when no websocket subscriber exists
   - no fallback delivery while websocket channel is active
