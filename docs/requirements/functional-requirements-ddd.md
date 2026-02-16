# FoodPanda-Style Delivery Platform Functional Requirements Document (DDD)

## 1. Document Frame And Governance

- Document version: `1.0.0`
- Status: `Draft for implementation`
- Date: `2026-02-16`
- Product scope: `Balanced V1`
- Geography: `US single metro launch`

### 1.1 Purpose

Define decision-complete functional requirements for a food delivery marketplace platform using Domain-Driven Design (DDD). This document is the single source of truth for product behavior, domain boundaries, and requirement traceability into architecture, testing, and deployment.

### 1.2 Audience

- Product management
- Backend, mobile, web, and platform engineering
- Security and compliance
- QA/SDET
- SRE and operations
- Finance operations and support operations

### 1.3 In-Scope

- Consumer ordering flow: discovery through delivery completion
- Merchant operations: menus, availability, order handling
- Courier operations: assignment, pickup, dropoff, proof-of-delivery
- Hybrid fleet model: platform courier plus merchant self-delivery
- Cash and cashless payments
- Refund, settlement, and payout workflows
- Support workflows and operational overrides
- Enterprise-grade controls, auditability, and reliability targets

### 1.4 Out-Of-Scope (Non-Goals)

- Internationalization and multi-country compliance in phase 1
- Subscription memberships and ad marketplace
- Voice ordering and chatbot-based ordering
- Multi-warehouse grocery logistics and dark-store orchestration
- Autonomous delivery integrations

### 1.5 Requirement ID Convention

All requirements use `FR-<Context>-<Number>`.
Examples:

- `FR-PAYMENTS-002`
- `FR-ORDERORCHESTRATION-004`

### 1.6 Versioning And Change Control

- Major (`X.0.0`): domain boundary or contract-breaking requirement changes
- Minor (`1.X.0`): additive requirements or acceptance criteria updates
- Patch (`1.0.X`): wording, clarity, typo fixes with no behavior change
- Any change to `FR-*` requirements requires:
  - linked architecture impact note,
  - updated acceptance test mapping,
  - approval from product + tech lead + security lead.

### 1.7 Locked Defaults

- Balanced V1
- AWS-first managed services
- Modular monolith core (TypeScript) + selective Go dispatch service
- Early scale: roughly 10k MAU and ~1k daily peak orders
- Enterprise-grade compliance posture
- Monthly infrastructure target under `$8,000`

## 2. Domain Foundations

### 2.1 Ubiquitous Language

| Term | Definition |
|---|---|
| `Basket` | Mutable collection of selected items before checkout. |
| `Quote` | Time-bound pricing result including taxes, fees, and discounts. |
| `Order` | Confirmed purchase intent accepted by the platform for fulfillment. |
| `Fulfillment` | Operational plan from merchant preparation to customer handoff. |
| `Courier Assignment` | Binding between an order and a courier for delivery legs. |
| `Settlement` | Financial reconciliation for merchant earnings, courier earnings, and platform fees. |
| `Refund` | Return of captured funds, full or partial, tied to a dispute or failure. |
| `Payout` | Transfer of owed balance to a merchant or courier account. |
| `Delivery Zone` | Geographic polygon and associated serviceability rules. |
| `SLA` | Time-based service objective for key order states and support response. |
| `Incident` | Operational event that materially impacts security, reliability, or data integrity. |

### 2.2 Bounded Contexts

- `Identity`
- `Consumer Ordering`
- `Merchant Catalog`
- `Pricing & Promotions`
- `Order Orchestration`
- `Dispatch`
- `Payments`
- `Settlement`
- `Support`
- `Notifications`
- `Risk & Compliance`
- `Platform` (cross-cutting NFR constraints)

### 2.3 Context Map And Integration Relationships

| Context | Upstream Dependencies | Downstream Consumers | Integration Style |
|---|---|---|---|
| Identity | None | All contexts | REST + JWT claims + ACL adapter |
| Consumer Ordering | Merchant Catalog, Pricing & Promotions | Order Orchestration | REST + domain events |
| Merchant Catalog | Identity | Consumer Ordering, Order Orchestration | REST read model + cache |
| Pricing & Promotions | Merchant Catalog | Consumer Ordering, Order Orchestration, Payments | Sync quote API + async promo events |
| Order Orchestration | Consumer Ordering, Dispatch, Payments, Risk & Compliance | Settlement, Notifications, Support | Command API + event choreography |
| Dispatch | Merchant Catalog, Order Orchestration | Order Orchestration, Notifications | gRPC + event bus |
| Payments | Order Orchestration, Pricing & Promotions, Risk & Compliance | Settlement, Support | REST to PSP + internal events |
| Settlement | Payments, Order Orchestration | Finance Ops, Payout processors | Batch/event processing |
| Support | Order Orchestration, Payments, Notifications | Risk & Compliance | Internal admin API |
| Notifications | Order Orchestration, Dispatch, Support | Consumer, Merchant, Courier channels | Event-driven fanout |
| Risk & Compliance | Identity, Order Orchestration, Payments, Support | Payments, Support, Audit | Policy decision APIs + immutable logs |

### 2.4 Anti-Corruption Layer Rules

- External payment provider objects must be mapped to internal `PaymentIntent` and `Capture` types.
- External maps/geocoding response types must be normalized to `DeliveryZone` and `RouteEstimate`.
- Third-party messaging delivery statuses must map to internal `NotificationDeliveryStatus` enum.

## 3. Actors And Access Envelope

| Actor | Core Responsibilities | Least-Privilege Envelope |
|---|---|---|
| Consumer | Browse, order, pay, track, request help/refund | Access own account, baskets, and orders only |
| Courier | Accept jobs, pickup/dropoff updates, proof submission | Access assigned jobs and own payout data only |
| Merchant Operator | Manage menu, inventory, store hours, accept/reject orders | Access own store entities only |
| Support Agent | Case handling, refunds, order interventions | Ticket-scoped read/write with action-based grants |
| Finance Ops | Reconciliation, settlement exception handling | Read settlement ledger, controlled payout actions |
| System Admin | Configuration and incident operations | Break-glass role with just-in-time elevation and mandatory reason code |

## 4. End-To-End Journeys

| Journey | Entry Trigger | Exit Condition | Key States | Success SLI |
|---|---|---|---|---|
| Onboarding | New actor registration | Verified account and profile complete | Registered -> Verified -> Active | `>99%` completion without manual intervention |
| Search/Discovery | Consumer opens app | Consumer selects merchant/item | Browsing -> Filtered -> Selected | Search response `p95 < 400 ms` |
| Checkout | Consumer submits basket | Order created and payment authorized/cash flagged | Basket -> Quote -> Checkout -> OrderCreated | Checkout success `>98%` |
| Assignment | Order ready for delivery | Courier or merchant self-delivery assigned | DispatchPending -> Assigned | Assignment `p95 < 120 sec` |
| Pickup/Dropoff | Courier reaches merchant | Delivery proof accepted | Assigned -> PickedUp -> Delivered | Delivery completion `>97%` |
| Partial Failure Handling | SLA breach or subsystem fault | Recovery path or customer resolution | Delayed -> Mitigated -> Resolved | Incident mitigation `p95 < 15 min` |
| Cancellation | User/system cancel action | Funds and states reconciled | CancelRequested -> Cancelled | Consistent final state in `<= 60 sec` |
| Refund | Dispute or failure case | Refund completed/declined with reason | RefundRequested -> RefundSettled | Refund SLA `p95 < 24 h` |
| Payout Reconciliation | Settlement window closes | Ledger reconciled and payout issued | Pending -> Reconciled -> PaidOut | Ledger mismatch `<0.1%` |
| Support Resolution | Ticket opened | Case closed with audit trail | Open -> Investigating -> Resolved | First response `p95 < 5 min` |

## 5. Functional Requirements By Bounded Context

### 5.1 Identity

#### Capabilities

- Registration, authentication, session management
- Role and permission assignment with least privilege
- MFA and risk-based step-up verification

#### Invariants

- One canonical `UserId` per identity subject.
- Privileged actions require traceable actor identity and reason code.

#### Lifecycle States

`PendingVerification -> Verified -> Active -> Suspended -> Deactivated`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-IDENTITY-001 | The system shall create user accounts with unique email/phone constraints. | `RegisterUser` | `identity.user_registered.v1` | Reject duplicate identifiers with deterministic error code. | `POST /api/v1/identity/register` | `TS-IDENTITY-001` | `DEP-IAM, DEP-POSTGRES` |
| FR-IDENTITY-002 | The system shall issue short-lived access tokens and rotating refresh tokens. | `AuthenticateUser`, `RefreshSession` | `identity.session_issued.v1` | Revoke refresh chain upon anomaly or replay detection. | `POST /api/v1/identity/token` | `TS-IDENTITY-002` | `DEP-IAM, DEP-REDIS` |
| FR-IDENTITY-003 | The system shall enforce role-based access with action-level permissions. | `AssignRole`, `EvaluatePermission` | `identity.role_assigned.v1` | Deny by default; return `403` with policy code. | Internal authz middleware | `TS-IDENTITY-003` | `DEP-IAM, DEP-FARGATE-CORE` |
| FR-IDENTITY-004 | The system shall enforce MFA for support, finance, and admin roles. | `EnrollMFA`, `VerifyMFA` | `identity.mfa_verified.v1` | Block privileged flow and generate security audit event. | `POST /api/v1/identity/mfa/verify` | `TS-IDENTITY-004` | `DEP-IAM, DEP-SECRETS` |

### 5.2 Consumer Ordering

#### Capabilities

- Discovery, basket, checkout orchestration
- Address and delivery preference management
- Order tracking read model

#### Invariants

- Basket currency and serviceability zone must remain consistent through checkout.
- Checkout requires quote freshness within TTL.

#### Lifecycle States

`Browsing -> BasketOpen -> QuoteReady -> CheckoutSubmitted -> OrderPlaced`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-CONSUMERORDERING-001 | The system shall maintain consumer baskets with item-level modifiers and notes. | `CreateBasket`, `AddItem`, `UpdateBasket` | `ordering.basket_updated.v1` | Reject unavailable item additions and return remediation hints. | `/api/v1/consumer/baskets/*` | `TS-CONSUMERORDERING-001` | `DEP-FARGATE-CORE, DEP-REDIS, DEP-POSTGRES` |
| FR-CONSUMERORDERING-002 | The system shall validate serviceability by delivery zone before quote generation. | `ValidateServiceability` | `ordering.serviceability_validated.v1` | Return out-of-zone result with nearest available alternatives. | `POST /api/v1/consumer/quotes/validate-zone` | `TS-CONSUMERORDERING-002` | `DEP-THIRDPARTY-MAPS, DEP-REDIS` |
| FR-CONSUMERORDERING-003 | The system shall generate checkout payloads referencing immutable quote snapshots. | `GenerateCheckout` | `ordering.checkout_prepared.v1` | Reject stale quote and force quote refresh. | `POST /api/v1/consumer/checkout` | `TS-CONSUMERORDERING-003` | `DEP-FARGATE-CORE, DEP-EVENTBUS` |
| FR-CONSUMERORDERING-004 | The system shall expose order timeline updates to consumers in near real time. | `GetOrderTimeline` | `ordering.timeline_projected.v1` | Fall back to polling when realtime stream unavailable. | `GET /api/v1/consumer/orders/{orderId}/timeline` | `TS-CONSUMERORDERING-004` | `DEP-CLOUDFRONT, DEP-EVENTBUS` |

### 5.3 Merchant Catalog

#### Capabilities

- Menu and modifier management
- Store schedule and temporary closure management
- Availability projection by zone and prep-time constraints

#### Invariants

- Catalog updates are versioned and must preserve history.
- Hidden/unavailable items must never appear in quote-eligible selection.

#### Lifecycle States

`Draft -> Published -> TemporarilyUnavailable -> Archived`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-MERCHANTCATALOG-001 | The system shall support merchant-managed menu CRUD with version history. | `CreateMenu`, `PublishMenu`, `UpdateMenu` | `catalog.menu_published.v1` | Reject invalid schema and preserve prior active version. | `/api/v1/merchant/catalog/*` | `TS-MERCHANTCATALOG-001` | `DEP-FARGATE-CORE, DEP-POSTGRES, DEP-S3` |
| FR-MERCHANTCATALOG-002 | The system shall enforce store hours and pause states for ordering eligibility. | `UpdateStoreSchedule`, `PauseStore` | `catalog.store_status_changed.v1` | Block order creation when store unavailable. | `POST /api/v1/merchant/stores/{id}/status` | `TS-MERCHANTCATALOG-002` | `DEP-REDIS, DEP-EVENTBUS` |
| FR-MERCHANTCATALOG-003 | The system shall provide prep-time estimates consumed by dispatch planning. | `EstimatePrepTime` | `catalog.prep_time_updated.v1` | Use median fallback prep-time if model output unavailable. | `GET /internal/catalog/stores/{id}/prep-time` | `TS-MERCHANTCATALOG-003` | `DEP-FARGATE-CORE, DEP-OBSERVABILITY` |
| FR-MERCHANTCATALOG-004 | The system shall support item-level stock depletion for high-velocity merchants. | `SetItemAvailability` | `catalog.item_availability_changed.v1` | Auto-hide unavailable item until restocked event received. | `POST /api/v1/merchant/items/{id}/availability` | `TS-MERCHANTCATALOG-004` | `DEP-POSTGRES, DEP-EVENTBUS` |

### 5.4 Pricing And Promotions

#### Capabilities

- Fee and tax composition
- Promotions and voucher eligibility
- Quote generation with deterministic pricing trace

#### Invariants

- A quote is immutable after issuance and expires at TTL.
- Discounts must never produce negative order totals.

#### Lifecycle States

`QuoteRequested -> QuoteIssued -> QuoteExpired -> QuoteConsumed`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-PRICINGPROMOTIONS-001 | The system shall calculate subtotal, tax, service fee, delivery fee, and total. | `GenerateQuote` | `pricing.quote_generated.v1` | Return structured calculation errors for unsupported tax jurisdiction config. | `POST /api/v1/consumer/quotes` | `TS-PRICINGPROMOTIONS-001` | `DEP-FARGATE-CORE, DEP-POSTGRES` |
| FR-PRICINGPROMOTIONS-002 | The system shall evaluate promo eligibility by user, merchant, and time window. | `EvaluatePromotion` | `pricing.promo_applied.v1` | Mark promotion as ineligible with machine-readable reason code. | `POST /api/v1/consumer/promotions/evaluate` | `TS-PRICINGPROMOTIONS-002` | `DEP-REDIS, DEP-POSTGRES` |
| FR-PRICINGPROMOTIONS-003 | The system shall reserve promotion usage atomically at checkout submit. | `ReservePromotionUsage` | `pricing.promo_reserved.v1` | Release reservation on payment/order failure. | Internal checkout command | `TS-PRICINGPROMOTIONS-003` | `DEP-POSTGRES, DEP-EVENTBUS` |
| FR-PRICINGPROMOTIONS-004 | The system shall emit pricing trace details for audit and support replay. | `PersistPricingTrace` | `pricing.trace_persisted.v1` | Capture fallback trace with degraded flag if full trace write fails. | Internal audit pipeline | `TS-PRICINGPROMOTIONS-004` | `DEP-S3, DEP-OBSERVABILITY` |

### 5.5 Order Orchestration

#### Capabilities

- Order aggregate lifecycle management
- Multi-step saga orchestration (payment, merchant acceptance, dispatch)
- Cancellation and compensation flows

#### Invariants

- `Order` state transitions are monotonic and auditable.
- Exactly one terminal state: `Delivered`, `Cancelled`, or `Failed`.

#### Lifecycle States

`Created -> MerchantAccepted -> DispatchPending -> InTransit -> Delivered`

`Created -> Cancelled` and `Created -> Failed` compensation branches

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-ORDERORCHESTRATION-001 | The system shall create order aggregates from validated checkout payloads only. | `CreateOrder` | `order.created.v1` | Reject creation when quote hash mismatch is detected. | `POST /api/v1/consumer/orders` | `TS-ORDERORCHESTRATION-001` | `DEP-FARGATE-CORE, DEP-POSTGRES` |
| FR-ORDERORCHESTRATION-002 | The system shall orchestrate merchant accept/reject with timeout fallback rules. | `RequestMerchantDecision`, `TimeoutMerchantDecision` | `order.merchant_decision_received.v1` | Auto-cancel on timeout and trigger compensation events. | Internal order state machine | `TS-ORDERORCHESTRATION-002` | `DEP-SQS, DEP-EVENTBUS` |
| FR-ORDERORCHESTRATION-003 | The system shall issue dispatch requests after payment/cash validation and merchant acceptance. | `RequestDispatch` | `dispatch.assignment.requested.v1` | Retry with exponential backoff then failover to support queue. | EventBridge topic | `TS-ORDERORCHESTRATION-003` | `DEP-EVENTBUS, DEP-FARGATE-DISPATCH` |
| FR-ORDERORCHESTRATION-004 | The system shall support cancellation by actor policy and current order state. | `RequestCancellation`, `ConfirmCancellation` | `order.cancel_requested.v1`, `order.cancelled.v1` | Enforce cancellation windows and required reason codes. | `/api/v1/consumer/orders/{id}/cancel` | `TS-ORDERORCHESTRATION-004` | `DEP-FARGATE-CORE, DEP-IAM` |
| FR-ORDERORCHESTRATION-005 | The system shall maintain immutable order timeline projections for all actors. | `ProjectTimeline` | `order.timeline_updated.v1` | Rebuild projection from event log if projection lag exceeds threshold. | `/api/v1/*/orders/{id}/timeline` | `TS-ORDERORCHESTRATION-005` | `DEP-EVENTBUS, DEP-S3, DEP-OBSERVABILITY` |

### 5.6 Dispatch

#### Capabilities

- Courier matching and assignment
- Route estimation and SLA-aware re-assignment
- Hybrid fleet policy (merchant self-delivery fallback)

#### Invariants

- One active assignment at a time per order.
- Assignment decisions must include deterministic score and reason trace.

#### Lifecycle States

`DispatchRequested -> Matching -> Assigned -> Reassigning -> Completed`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-DISPATCH-001 | The system shall score candidate couriers using distance, availability, and SLA pressure. | `ScoreCandidates` | `dispatch.candidates_scored.v1` | If scoring service degraded, switch to rules-based fallback. | gRPC `DispatchService/Score` | `TS-DISPATCH-001` | `DEP-FARGATE-DISPATCH, DEP-THIRDPARTY-MAPS` |
| FR-DISPATCH-002 | The system shall assign courier or merchant self-delivery based on policy matrix. | `AssignCourierOrMerchant` | `dispatch.assignment_completed.v1` | Escalate to support queue when no candidate within SLA bounds. | gRPC `DispatchService/Assign` | `TS-DISPATCH-002` | `DEP-FARGATE-DISPATCH, DEP-EVENTBUS` |
| FR-DISPATCH-003 | The system shall support reassignment when courier declines, times out, or no-shows. | `ReassignCourier` | `dispatch.reassignment_triggered.v1` | Cap retries and trigger compensation if max attempts reached. | Event `dispatch.reassignment.requested.v1` | `TS-DISPATCH-003` | `DEP-SQS, DEP-OBSERVABILITY` |
| FR-DISPATCH-004 | The system shall ingest courier telemetry and compute ETA updates. | `IngestTelemetry`, `UpdateETA` | `dispatch.eta_updated.v1` | Drop out-of-order telemetry and mark confidence degraded. | `POST /api/v1/courier/telemetry` | `TS-DISPATCH-004` | `DEP-FARGATE-DISPATCH, DEP-REDIS` |
| FR-DISPATCH-005 | The system shall enforce courier capacity and legal rest constraints. | `ValidateCourierCapacity` | `dispatch.capacity_rejected.v1` | Block assignment and surface reason to dispatch console. | Internal policy check | `TS-DISPATCH-005` | `DEP-POSTGRES, DEP-IAM` |

### 5.7 Payments

#### Capabilities

- Authorization, capture, void, and cash collection state management
- Refund processing and dispute hooks
- PSP abstraction with anti-corruption mapping

#### Invariants

- Payment amount integrity must match quote/order ledger.
- Captures and refunds are idempotent by external reference.

#### Lifecycle States

`Initiated -> Authorized -> Captured -> Refunded (partial/full) -> Closed`

For cash orders:

`CashExpected -> CashCollected -> Reconciled`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-PAYMENTS-001 | The system shall authorize digital payments before merchant acceptance timeout completion. | `AuthorizePayment` | `payment.authorized.v1` | Retry transient PSP failures and mark order at-risk after threshold. | `/api/v1/payments/authorize` | `TS-PAYMENTS-001` | `DEP-THIRDPARTY-PAYMENT, DEP-SECRETS` |
| FR-PAYMENTS-002 | The system shall capture funds only after merchant acceptance and dispatch readiness. | `CapturePayment` | `payment.captured.v1` | Void authorization if capture preconditions fail. | Internal payment command bus | `TS-PAYMENTS-002` | `DEP-EVENTBUS, DEP-POSTGRES` |
| FR-PAYMENTS-003 | The system shall track cash-on-delivery expected and collected amounts. | `MarkCashExpected`, `ConfirmCashCollected` | `payment.cash_expected.v1`, `payment.cash_collected.v1` | Trigger exception workflow when collected amount mismatches expectation. | `/api/v1/courier/orders/{id}/cash-collection` | `TS-PAYMENTS-003` | `DEP-FARGATE-CORE, DEP-POSTGRES` |
| FR-PAYMENTS-004 | The system shall support partial and full refunds with reason taxonomy. | `RequestRefund`, `ApproveRefund` | `refund.requested.v1`, `refund.completed.v1` | Route high-value refunds to manual approval policy. | `/api/v1/support/refunds/*` | `TS-PAYMENTS-004` | `DEP-THIRDPARTY-PAYMENT, DEP-IAM` |
| FR-PAYMENTS-005 | The system shall preserve immutable payment audit trails for all state transitions. | `AppendPaymentAuditRecord` | `payment.audit_recorded.v1` | Write to durable append-only audit stream; alert on write failure. | Audit event sink | `TS-PAYMENTS-005` | `DEP-S3, DEP-KMS, DEP-OBSERVABILITY` |

### 5.8 Settlement

#### Capabilities

- Ledgering platform, merchant, and courier balances
- Scheduled payout generation
- Reconciliation and exception handling

#### Invariants

- Double-entry ledger must balance per settlement cycle.
- Payout execution requires reconciled ledger state.

#### Lifecycle States

`Unsettled -> Settled -> PayoutScheduled -> PaidOut -> Reconciled`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-SETTLEMENT-001 | The system shall post ledger entries for each capture, fee, refund, and adjustment. | `PostLedgerEntry` | `settlement.ledger_entry_posted.v1` | Reject unbalanced journal entry and quarantine record for review. | Internal settlement pipeline | `TS-SETTLEMENT-001` | `DEP-POSTGRES, DEP-S3` |
| FR-SETTLEMENT-002 | The system shall generate payout batches on configurable schedules. | `GeneratePayoutBatch` | `payout.batch_generated.v1` | Skip entities with unresolved exceptions and emit hold reason. | `/api/v1/admin/payouts/generate` | `TS-SETTLEMENT-002` | `DEP-SQS, DEP-FARGATE-CORE` |
| FR-SETTLEMENT-003 | The system shall reconcile expected vs actual processor settlement files. | `ReconcileSettlementFiles` | `settlement.reconciliation_completed.v1` | Create exception case for mismatches above tolerance. | S3 ingest + reconciliation job | `TS-SETTLEMENT-003` | `DEP-S3, DEP-OBSERVABILITY` |
| FR-SETTLEMENT-004 | The system shall expose payout statements to merchants and couriers. | `PublishPayoutStatement` | `payout.statement_published.v1` | Retry rendering pipeline, then publish plain-text fallback statement. | `/api/v1/merchant/payouts/*`, `/api/v1/courier/payouts/*` | `TS-SETTLEMENT-004` | `DEP-S3, DEP-CLOUDFRONT` |

### 5.9 Support

#### Capabilities

- Ticket lifecycle management
- Agent tools for order/payment interventions
- SLA and escalation policies

#### Invariants

- Every agent action is linked to a ticket and reason code.
- Policy-protected actions require explicit approval path.

#### Lifecycle States

`Open -> Investigating -> PendingCustomer -> Resolved -> Closed`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-SUPPORT-001 | The system shall create support tickets linked to actor and order identifiers. | `CreateTicket` | `support.ticket_created.v1` | Reject ticket creation with missing linkage fields. | `/api/v1/support/tickets` | `TS-SUPPORT-001` | `DEP-FARGATE-CORE, DEP-POSTGRES` |
| FR-SUPPORT-002 | The system shall provide ticket timeline with correlated order and payment events. | `GetTicketTimeline` | `support.timeline_viewed.v1` | Degrade to partial timeline and show missing source indicator. | `GET /api/v1/support/tickets/{id}/timeline` | `TS-SUPPORT-002` | `DEP-EVENTBUS, DEP-OBSERVABILITY` |
| FR-SUPPORT-003 | The system shall allow policy-constrained manual interventions (cancel, refund, reassignment). | `ExecuteIntervention` | `support.intervention_executed.v1` | Require supervisor approval for high-risk actions. | `/api/v1/support/interventions/*` | `TS-SUPPORT-003` | `DEP-IAM, DEP-SECRETS` |
| FR-SUPPORT-004 | The system shall enforce ticket SLA timers and escalation workflows. | `EvaluateSLABreach`, `EscalateTicket` | `support.ticket_escalated.v1` | Route unresolved high-severity tickets to on-call channel. | Internal SLA scheduler | `TS-SUPPORT-004` | `DEP-SQS, DEP-THIRDPARTY-MESSAGING` |

### 5.10 Notifications

#### Capabilities

- Multi-channel notifications (push, SMS, email)
- Template and locale-aware message rendering
- Delivery status tracking and retries

#### Invariants

- Notification sends must be idempotent per `(channel, template, entityId)`.
- Critical notifications must have at least one acknowledged delivery attempt.

#### Lifecycle States

`Pending -> Sent -> Delivered -> Acknowledged` with `Failed` branch

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-NOTIFICATIONS-001 | The system shall consume order/dispatch/support events and fan out channel notifications. | `QueueNotification` | `notification.queued.v1` | Dead-letter permanently failing payloads with reason metadata. | EventBridge -> SQS consumers | `TS-NOTIFICATIONS-001` | `DEP-EVENTBUS, DEP-SQS` |
| FR-NOTIFICATIONS-002 | The system shall select templates by actor, locale, and event type. | `ResolveTemplate` | `notification.template_resolved.v1` | Use default locale fallback and mark localization warning. | Internal template resolver | `TS-NOTIFICATIONS-002` | `DEP-S3, DEP-FARGATE-CORE` |
| FR-NOTIFICATIONS-003 | The system shall retry transient delivery failures with capped backoff policy. | `RetryNotification` | `notification.retry_scheduled.v1` | Stop after retry cap and emit support-visible failure event. | Notification worker queue | `TS-NOTIFICATIONS-003` | `DEP-SQS, DEP-OBSERVABILITY` |
| FR-NOTIFICATIONS-004 | The system shall persist delivery receipts for compliance and support audits. | `RecordDeliveryReceipt` | `notification.delivery_recorded.v1` | Write to immutable store and alert on persistence errors. | `/internal/notifications/receipts` | `TS-NOTIFICATIONS-004` | `DEP-S3, DEP-KMS` |

### 5.11 Risk And Compliance

#### Capabilities

- Fraud/risk scoring for users, orders, and payments
- Policy engine for action allow/deny/review
- Compliance evidence and immutable audit logging

#### Invariants

- High-risk decisions must be explainable and reproducible.
- Compliance-relevant actions must emit immutable audit events.

#### Lifecycle States

`Screening -> Approved -> Challenged -> Blocked -> Reviewed`

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-RISKCOMPLIANCE-001 | The system shall risk-score each order before payment capture. | `ScoreOrderRisk` | `risk.order_scored.v1` | Default to challenge flow if risk engine unavailable. | Internal policy call during orchestration | `TS-RISKCOMPLIANCE-001` | `DEP-FARGATE-CORE, DEP-OBSERVABILITY` |
| FR-RISKCOMPLIANCE-002 | The system shall enforce configurable allow/deny/review policies per action type. | `EvaluatePolicyDecision` | `risk.policy_decision_made.v1` | Deny unknown policy paths by default. | `/internal/risk/policy/evaluate` | `TS-RISKCOMPLIANCE-002` | `DEP-IAM, DEP-POSTGRES` |
| FR-RISKCOMPLIANCE-003 | The system shall require manual review workflow for flagged refunds and payouts. | `QueueManualReview`, `ResolveManualReview` | `risk.manual_review_queued.v1`, `risk.manual_review_resolved.v1` | Hold funds and block payout completion until review closure. | `/api/v1/admin/risk/reviews/*` | `TS-RISKCOMPLIANCE-003` | `DEP-SQS, DEP-IAM` |
| FR-RISKCOMPLIANCE-004 | The system shall maintain immutable audit logs for payment/refund/payout/admin actions. | `AppendComplianceAuditLog` | `risk.audit_log_appended.v1` | Write-once storage fallback if primary audit sink degraded. | Compliance log stream | `TS-RISKCOMPLIANCE-004` | `DEP-S3, DEP-KMS, DEP-OBSERVABILITY` |

### 5.12 Platform Constraints (Cross-Cutting NFR As Functional Constraints)

#### Invariants

- Critical APIs must satisfy declared SLOs.
- DR controls must satisfy RPO/RTO baselines.
- Observability controls must provide per-request and per-event traceability.

| ID | Requirement | Commands | Domain Events | Failure Behavior | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|---|---|---|
| FR-PLATFORM-001 | The platform shall provide `99.9%` monthly availability for consumer checkout and order APIs. | `EvaluateAvailabilitySLO` | `platform.slo_breach_detected.v1` | Trigger incident automation and rollback policy. | `/api/v1/consumer/*` | `TS-PLATFORM-001` | `DEP-ALB, DEP-FARGATE-CORE, DEP-OBSERVABILITY` |
| FR-PLATFORM-002 | The platform shall meet latency budgets: checkout `p95 < 700 ms`, timeline read `p95 < 400 ms`. | `MeasureLatencyBudget` | `platform.latency_budget_breached.v1` | Auto-scale and enable read-path degradation mode. | API gateway metrics pipeline | `TS-PLATFORM-002` | `DEP-ALB, DEP-REDIS` |
| FR-PLATFORM-003 | The platform shall enforce encryption in transit (TLS 1.2+) and at rest for all persistent stores. | `EnforceEncryptionPolicy` | `platform.encryption_policy_checked.v1` | Block deployment if encryption policy check fails. | CI/CD security gate | `TS-PLATFORM-003` | `DEP-KMS, DEP-CICD` |
| FR-PLATFORM-004 | The platform shall maintain RPO <= 15 minutes and RTO <= 60 minutes for order/payment data. | `RunBackup`, `ExecuteDRFailover` | `platform.dr_drill_completed.v1` | Fail DR gate and block production release on unmet objectives. | DR runbook execution workflow | `TS-PLATFORM-004` | `DEP-DR, DEP-POSTGRES, DEP-S3` |
| FR-PLATFORM-005 | The platform shall emit structured logs, metrics, and distributed traces for all critical paths. | `EmitObservabilitySignals` | `platform.trace_emitted.v1` | Mark blind-spot alert when telemetry coverage drops below threshold. | OpenTelemetry pipeline | `TS-PLATFORM-005` | `DEP-OBSERVABILITY` |
| FR-PLATFORM-006 | The platform shall require immutable audit trails for privileged and financial operations. | `RecordPrivilegedAction` | `platform.privileged_action_recorded.v1` | Block operation completion if audit write fails. | Admin and financial action middleware | `TS-PLATFORM-006` | `DEP-S3, DEP-KMS` |
| FR-PLATFORM-007 | The platform shall maintain security evidence artifacts for enterprise compliance controls. | `GenerateComplianceEvidence` | `platform.evidence_generated.v1` | Raise compliance incident when evidence job misses schedule. | Compliance evidence job outputs | `TS-PLATFORM-007` | `DEP-S3, DEP-CICD, DEP-OBSERVABILITY` |
| FR-PLATFORM-008 | The platform shall provide environment segregation for `dev`, `staging`, and `prod` with least-privilege access. | `PromoteRelease`, `ValidateEnvironmentBoundary` | `platform.release_promoted.v1` | Deny promotion when boundary checks fail. | CI/CD promotion pipeline | `TS-PLATFORM-008` | `DEP-CICD, DEP-IAM` |

## 6. Cross-Cutting Acceptance Criteria

- All `FR-*` requirements must have:
  - automated test scenario implementation,
  - contract mapping in the API/event contract document,
  - deployment dependency represented in infrastructure definitions,
  - observability signal coverage.
- Release gate must fail when:
  - backward-incompatible contract change lacks explicit major version bump,
  - required audit events are missing,
  - DR objective validation is older than 30 days,
  - critical SLO regression exceeds threshold.

## 7. Traceability Matrix

### 7.1 Test Scenario Catalog

Test scenarios follow `TS-<Context>-<Number>` and are defined in architecture test plans. Example categories:

- Domain correctness and lifecycle transitions
- Failure injection and compensation behavior
- Security authorization and auditability
- Contract compatibility and idempotency replay
- DR and resilience validation

### 7.2 Deployment Dependency Catalog

- `DEP-ALB`: Application Load Balancer
- `DEP-CICD`: CI/CD pipeline and release gates
- `DEP-CLOUDFRONT`: CloudFront CDN distribution
- `DEP-DR`: Backup, restore, failover controls
- `DEP-EVENTBUS`: EventBridge event bus
- `DEP-FARGATE-CORE`: Core TypeScript service on ECS Fargate
- `DEP-FARGATE-DISPATCH`: Go dispatch service on ECS Fargate
- `DEP-IAM`: IAM roles/policies and authn/authz controls
- `DEP-KMS`: KMS key management and envelope encryption
- `DEP-OBSERVABILITY`: Logs/metrics/traces and alerting
- `DEP-POSTGRES`: Managed PostgreSQL (multi-AZ)
- `DEP-REDIS`: Managed Redis cache
- `DEP-S3`: S3 object storage and immutable log archives
- `DEP-SECRETS`: Secrets management service
- `DEP-SQS`: SQS queueing and DLQ
- `DEP-THIRDPARTY-MAPS`: Maps/geocoding provider
- `DEP-THIRDPARTY-MESSAGING`: SMS/email/push providers
- `DEP-THIRDPARTY-PAYMENT`: Payment service provider(s)

### 7.3 Requirement-To-Implementation Mapping

| Requirement ID | Owner Context | API/Event Touchpoint | Test Scenario | Deployment Dependency |
|---|---|---|---|---|
| FR-IDENTITY-001 | Identity | `POST /api/v1/identity/register` | `TS-IDENTITY-001` | `DEP-IAM, DEP-POSTGRES` |
| FR-IDENTITY-002 | Identity | `POST /api/v1/identity/token` | `TS-IDENTITY-002` | `DEP-IAM, DEP-REDIS` |
| FR-IDENTITY-003 | Identity | Authz middleware | `TS-IDENTITY-003` | `DEP-IAM, DEP-FARGATE-CORE` |
| FR-IDENTITY-004 | Identity | `POST /api/v1/identity/mfa/verify` | `TS-IDENTITY-004` | `DEP-IAM, DEP-SECRETS` |
| FR-CONSUMERORDERING-001 | Consumer Ordering | `/api/v1/consumer/baskets/*` | `TS-CONSUMERORDERING-001` | `DEP-FARGATE-CORE, DEP-REDIS, DEP-POSTGRES` |
| FR-CONSUMERORDERING-002 | Consumer Ordering | `POST /api/v1/consumer/quotes/validate-zone` | `TS-CONSUMERORDERING-002` | `DEP-THIRDPARTY-MAPS, DEP-REDIS` |
| FR-CONSUMERORDERING-003 | Consumer Ordering | `POST /api/v1/consumer/checkout` | `TS-CONSUMERORDERING-003` | `DEP-FARGATE-CORE, DEP-EVENTBUS` |
| FR-CONSUMERORDERING-004 | Consumer Ordering | `GET /api/v1/consumer/orders/{orderId}/timeline` | `TS-CONSUMERORDERING-004` | `DEP-CLOUDFRONT, DEP-EVENTBUS` |
| FR-MERCHANTCATALOG-001 | Merchant Catalog | `/api/v1/merchant/catalog/*` | `TS-MERCHANTCATALOG-001` | `DEP-FARGATE-CORE, DEP-POSTGRES, DEP-S3` |
| FR-MERCHANTCATALOG-002 | Merchant Catalog | `POST /api/v1/merchant/stores/{id}/status` | `TS-MERCHANTCATALOG-002` | `DEP-REDIS, DEP-EVENTBUS` |
| FR-MERCHANTCATALOG-003 | Merchant Catalog | `GET /internal/catalog/stores/{id}/prep-time` | `TS-MERCHANTCATALOG-003` | `DEP-FARGATE-CORE, DEP-OBSERVABILITY` |
| FR-MERCHANTCATALOG-004 | Merchant Catalog | `POST /api/v1/merchant/items/{id}/availability` | `TS-MERCHANTCATALOG-004` | `DEP-POSTGRES, DEP-EVENTBUS` |
| FR-PRICINGPROMOTIONS-001 | Pricing & Promotions | `POST /api/v1/consumer/quotes` | `TS-PRICINGPROMOTIONS-001` | `DEP-FARGATE-CORE, DEP-POSTGRES` |
| FR-PRICINGPROMOTIONS-002 | Pricing & Promotions | `POST /api/v1/consumer/promotions/evaluate` | `TS-PRICINGPROMOTIONS-002` | `DEP-REDIS, DEP-POSTGRES` |
| FR-PRICINGPROMOTIONS-003 | Pricing & Promotions | Checkout internal command | `TS-PRICINGPROMOTIONS-003` | `DEP-POSTGRES, DEP-EVENTBUS` |
| FR-PRICINGPROMOTIONS-004 | Pricing & Promotions | Audit pipeline | `TS-PRICINGPROMOTIONS-004` | `DEP-S3, DEP-OBSERVABILITY` |
| FR-ORDERORCHESTRATION-001 | Order Orchestration | `POST /api/v1/consumer/orders` | `TS-ORDERORCHESTRATION-001` | `DEP-FARGATE-CORE, DEP-POSTGRES` |
| FR-ORDERORCHESTRATION-002 | Order Orchestration | State machine | `TS-ORDERORCHESTRATION-002` | `DEP-SQS, DEP-EVENTBUS` |
| FR-ORDERORCHESTRATION-003 | Order Orchestration | `dispatch.assignment.requested.v1` | `TS-ORDERORCHESTRATION-003` | `DEP-EVENTBUS, DEP-FARGATE-DISPATCH` |
| FR-ORDERORCHESTRATION-004 | Order Orchestration | `/api/v1/consumer/orders/{id}/cancel` | `TS-ORDERORCHESTRATION-004` | `DEP-FARGATE-CORE, DEP-IAM` |
| FR-ORDERORCHESTRATION-005 | Order Orchestration | `/api/v1/*/orders/{id}/timeline` | `TS-ORDERORCHESTRATION-005` | `DEP-EVENTBUS, DEP-S3, DEP-OBSERVABILITY` |
| FR-DISPATCH-001 | Dispatch | `DispatchService/Score` | `TS-DISPATCH-001` | `DEP-FARGATE-DISPATCH, DEP-THIRDPARTY-MAPS` |
| FR-DISPATCH-002 | Dispatch | `DispatchService/Assign` | `TS-DISPATCH-002` | `DEP-FARGATE-DISPATCH, DEP-EVENTBUS` |
| FR-DISPATCH-003 | Dispatch | `dispatch.reassignment.requested.v1` | `TS-DISPATCH-003` | `DEP-SQS, DEP-OBSERVABILITY` |
| FR-DISPATCH-004 | Dispatch | `POST /api/v1/courier/telemetry` | `TS-DISPATCH-004` | `DEP-FARGATE-DISPATCH, DEP-REDIS` |
| FR-DISPATCH-005 | Dispatch | Internal policy check | `TS-DISPATCH-005` | `DEP-POSTGRES, DEP-IAM` |
| FR-PAYMENTS-001 | Payments | `/api/v1/payments/authorize` | `TS-PAYMENTS-001` | `DEP-THIRDPARTY-PAYMENT, DEP-SECRETS` |
| FR-PAYMENTS-002 | Payments | Internal command bus | `TS-PAYMENTS-002` | `DEP-EVENTBUS, DEP-POSTGRES` |
| FR-PAYMENTS-003 | Payments | `/api/v1/courier/orders/{id}/cash-collection` | `TS-PAYMENTS-003` | `DEP-FARGATE-CORE, DEP-POSTGRES` |
| FR-PAYMENTS-004 | Payments | `/api/v1/support/refunds/*` | `TS-PAYMENTS-004` | `DEP-THIRDPARTY-PAYMENT, DEP-IAM` |
| FR-PAYMENTS-005 | Payments | Audit event sink | `TS-PAYMENTS-005` | `DEP-S3, DEP-KMS, DEP-OBSERVABILITY` |
| FR-SETTLEMENT-001 | Settlement | Internal settlement pipeline | `TS-SETTLEMENT-001` | `DEP-POSTGRES, DEP-S3` |
| FR-SETTLEMENT-002 | Settlement | `/api/v1/admin/payouts/generate` | `TS-SETTLEMENT-002` | `DEP-SQS, DEP-FARGATE-CORE` |
| FR-SETTLEMENT-003 | Settlement | S3 ingest + reconciliation job | `TS-SETTLEMENT-003` | `DEP-S3, DEP-OBSERVABILITY` |
| FR-SETTLEMENT-004 | Settlement | `/api/v1/merchant/payouts/*`, `/api/v1/courier/payouts/*` | `TS-SETTLEMENT-004` | `DEP-S3, DEP-CLOUDFRONT` |
| FR-SUPPORT-001 | Support | `/api/v1/support/tickets` | `TS-SUPPORT-001` | `DEP-FARGATE-CORE, DEP-POSTGRES` |
| FR-SUPPORT-002 | Support | `GET /api/v1/support/tickets/{id}/timeline` | `TS-SUPPORT-002` | `DEP-EVENTBUS, DEP-OBSERVABILITY` |
| FR-SUPPORT-003 | Support | `/api/v1/support/interventions/*` | `TS-SUPPORT-003` | `DEP-IAM, DEP-SECRETS` |
| FR-SUPPORT-004 | Support | SLA scheduler | `TS-SUPPORT-004` | `DEP-SQS, DEP-THIRDPARTY-MESSAGING` |
| FR-NOTIFICATIONS-001 | Notifications | EventBridge -> SQS consumers | `TS-NOTIFICATIONS-001` | `DEP-EVENTBUS, DEP-SQS` |
| FR-NOTIFICATIONS-002 | Notifications | Template resolver | `TS-NOTIFICATIONS-002` | `DEP-S3, DEP-FARGATE-CORE` |
| FR-NOTIFICATIONS-003 | Notifications | Notification worker queue | `TS-NOTIFICATIONS-003` | `DEP-SQS, DEP-OBSERVABILITY` |
| FR-NOTIFICATIONS-004 | Notifications | `/internal/notifications/receipts` | `TS-NOTIFICATIONS-004` | `DEP-S3, DEP-KMS` |
| FR-RISKCOMPLIANCE-001 | Risk & Compliance | Policy call during orchestration | `TS-RISKCOMPLIANCE-001` | `DEP-FARGATE-CORE, DEP-OBSERVABILITY` |
| FR-RISKCOMPLIANCE-002 | Risk & Compliance | `/internal/risk/policy/evaluate` | `TS-RISKCOMPLIANCE-002` | `DEP-IAM, DEP-POSTGRES` |
| FR-RISKCOMPLIANCE-003 | Risk & Compliance | `/api/v1/admin/risk/reviews/*` | `TS-RISKCOMPLIANCE-003` | `DEP-SQS, DEP-IAM` |
| FR-RISKCOMPLIANCE-004 | Risk & Compliance | Compliance log stream | `TS-RISKCOMPLIANCE-004` | `DEP-S3, DEP-KMS, DEP-OBSERVABILITY` |
| FR-PLATFORM-001 | Platform | `/api/v1/consumer/*` | `TS-PLATFORM-001` | `DEP-ALB, DEP-FARGATE-CORE, DEP-OBSERVABILITY` |
| FR-PLATFORM-002 | Platform | API metrics pipeline | `TS-PLATFORM-002` | `DEP-ALB, DEP-REDIS` |
| FR-PLATFORM-003 | Platform | CI/CD security gate | `TS-PLATFORM-003` | `DEP-KMS, DEP-CICD` |
| FR-PLATFORM-004 | Platform | DR runbook workflow | `TS-PLATFORM-004` | `DEP-DR, DEP-POSTGRES, DEP-S3` |
| FR-PLATFORM-005 | Platform | OpenTelemetry pipeline | `TS-PLATFORM-005` | `DEP-OBSERVABILITY` |
| FR-PLATFORM-006 | Platform | Privileged action middleware | `TS-PLATFORM-006` | `DEP-S3, DEP-KMS` |
| FR-PLATFORM-007 | Platform | Compliance evidence jobs | `TS-PLATFORM-007` | `DEP-S3, DEP-CICD, DEP-OBSERVABILITY` |
| FR-PLATFORM-008 | Platform | Release promotion pipeline | `TS-PLATFORM-008` | `DEP-CICD, DEP-IAM` |

## 8. Approval Criteria

The FRD is approved for implementation when:

- all `FR-*` requirements are reviewed and accepted by product, engineering, and security,
- all required APIs and events are reflected in `api-and-event-contracts-v1.md`,
- architecture alignment section references every bounded context,
- deployment and cost document contains each dependency class listed in this FRD.
