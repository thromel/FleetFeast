# API And Event Contracts (V1)

- Version: `1.0.0`
- Date: `2026-02-16`
- Scope: public REST APIs, internal gRPC contracts, and domain event schemas

## 1. Contract Governance Principles

- Backward-compatible additive changes are allowed within major version `v1`.
- Breaking API changes require new path major (`/api/v2/*`).
- Breaking event schema changes require new major topic suffix (`.v2`).
- Consumer-driven contract tests are mandatory production release gates.
- Every contract change must reference impacted `FR-*` requirements.

## 2. API Namespaces

- `/api/v1/consumer/*`
- `/api/v1/merchant/*`
- `/api/v1/courier/*`
- `/api/v1/admin/*`

## 3. Authentication, Authorization, And Common Headers

### 3.1 Auth

- OAuth2/JWT for actor sessions
- Service-to-service auth via workload identity
- Privileged actions require MFA claim and role claim

### 3.2 Required Headers

- `Authorization: Bearer <token>`
- `X-Request-Id: <uuid>`
- `X-Idempotency-Key: <key>` for create/update financial operations
- `X-Client-Version: <semver>`

### 3.3 Common Error Schema

```json
{
  "errorCode": "PAYMENT_AUTH_FAILED",
  "message": "Payment authorization failed",
  "retryable": true,
  "details": {
    "policyCode": "RISK_REVIEW_REQUIRED"
  }
}
```

## 4. Canonical Contract Types

### 4.1 `Order`

| Field | Type | Required | Notes |
|---|---|---|---|
| `orderId` | string (UUID) | yes | System-generated immutable identifier |
| `consumerId` | string | yes | Owner actor |
| `merchantId` | string | yes | Fulfillment merchant |
| `status` | `OrderStatus` | yes | Current lifecycle state |
| `quoteId` | string | yes | Quote snapshot reference |
| `paymentIntentId` | string | no | Null for cash until expected cash record created |
| `fulfillmentPlan` | `FulfillmentPlan` | yes | Delivery method and timing |
| `totals` | object | yes | Subtotal, fees, tax, total |
| `createdAt` | timestamp | yes | UTC |
| `updatedAt` | timestamp | yes | UTC |

### 4.2 `OrderStatus`

Enum values:

- `CREATED`
- `MERCHANT_ACCEPTED`
- `DISPATCH_PENDING`
- `ASSIGNED`
- `PICKED_UP`
- `IN_TRANSIT`
- `DELIVERED`
- `CANCELLED`
- `FAILED`

### 4.3 `FulfillmentPlan`

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | enum | yes | `PLATFORM_COURIER` or `MERCHANT_SELF_DELIVERY` |
| `pickupEta` | timestamp | no | Estimated pickup time |
| `dropoffEta` | timestamp | no | Estimated dropoff time |
| `deliveryZoneId` | string | yes | Serviceability zone |
| `assignment` | `CourierAssignment` | no | Present after assignment |

### 4.4 `CourierAssignment`

| Field | Type | Required | Notes |
|---|---|---|---|
| `assignmentId` | string | yes | Immutable assignment id |
| `courierId` | string | conditional | Required if mode is platform courier |
| `merchantSelfDelivery` | boolean | yes | Hybrid fleet support |
| `score` | number | yes | Deterministic selection score |
| `reasonCodes` | string[] | yes | Explainability and audit |

### 4.5 `PaymentIntent`

| Field | Type | Required | Notes |
|---|---|---|---|
| `paymentIntentId` | string | yes | Internal canonical id |
| `orderId` | string | yes | Parent order |
| `method` | enum | yes | `CARD`, `APPLE_PAY`, `GOOGLE_PAY`, `CASH` |
| `status` | enum | yes | `INITIATED`, `AUTHORIZED`, `CAPTURED`, `VOIDED`, `REFUNDED` |
| `amount` | integer | yes | Minor units |
| `currency` | string | yes | ISO-4217 |
| `providerReference` | string | no | External PSP reference |

### 4.6 `RefundRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `refundRequestId` | string | yes | Unique id |
| `orderId` | string | yes | Linked order |
| `paymentIntentId` | string | yes | Linked payment |
| `amount` | integer | yes | Minor units |
| `reasonCode` | string | yes | Controlled taxonomy |
| `status` | enum | yes | `REQUESTED`, `APPROVED`, `DECLINED`, `COMPLETED` |

### 4.7 `SettlementRecord`

| Field | Type | Required | Notes |
|---|---|---|---|
| `settlementRecordId` | string | yes | Unique id |
| `orderId` | string | yes | Linked order |
| `merchantNet` | integer | yes | Minor units |
| `courierNet` | integer | yes | Minor units |
| `platformFee` | integer | yes | Minor units |
| `status` | enum | yes | `UNSETTLED`, `SETTLED`, `PAID_OUT` |

### 4.8 `PayoutBatch`

| Field | Type | Required | Notes |
|---|---|---|---|
| `payoutBatchId` | string | yes | Unique id |
| `entityType` | enum | yes | `MERCHANT` or `COURIER` |
| `entityId` | string | yes | Payee id |
| `totalAmount` | integer | yes | Minor units |
| `scheduledAt` | timestamp | yes | UTC |
| `status` | enum | yes | `GENERATED`, `SUBMITTED`, `RECONCILED`, `FAILED` |

### 4.9 `AuditEvent`

| Field | Type | Required | Notes |
|---|---|---|---|
| `auditEventId` | string | yes | Immutable id |
| `actorId` | string | yes | Initiating actor or service |
| `actionType` | string | yes | Example: `REFUND_APPROVED` |
| `targetId` | string | yes | Entity reference |
| `reasonCode` | string | yes | Mandatory for privileged actions |
| `timestamp` | timestamp | yes | UTC |
| `metadata` | object | no | Additional context |

## 5. Public REST Contract Catalog

### 5.1 Consumer APIs

| Method | Path | Purpose | Idempotency |
|---|---|---|---|
| `POST` | `/api/v1/consumer/baskets` | Create basket | Optional |
| `PATCH` | `/api/v1/consumer/baskets/{basketId}` | Update basket | Optional |
| `POST` | `/api/v1/consumer/quotes` | Generate quote | Optional |
| `POST` | `/api/v1/consumer/checkout` | Prepare checkout payload | Recommended |
| `POST` | `/api/v1/consumer/orders` | Create order | Required |
| `GET` | `/api/v1/consumer/orders/{orderId}` | Get order details | N/A |
| `GET` | `/api/v1/consumer/orders/{orderId}/timeline` | Get order timeline | N/A |
| `POST` | `/api/v1/consumer/orders/{orderId}/cancel` | Request cancellation | Required |

### 5.2 Merchant APIs

| Method | Path | Purpose | Idempotency |
|---|---|---|---|
| `GET` | `/api/v1/merchant/orders` | List merchant orders | N/A |
| `POST` | `/api/v1/merchant/orders/{orderId}/accept` | Accept order | Required |
| `POST` | `/api/v1/merchant/orders/{orderId}/reject` | Reject order | Required |
| `PUT` | `/api/v1/merchant/catalog/menus/{menuId}` | Update menu | Required |
| `POST` | `/api/v1/merchant/items/{itemId}/availability` | Toggle stock availability | Required |
| `GET` | `/api/v1/merchant/payouts` | List payout statements | N/A |

### 5.3 Courier APIs

| Method | Path | Purpose | Idempotency |
|---|---|---|---|
| `GET` | `/api/v1/courier/jobs/available` | List available assignments | N/A |
| `POST` | `/api/v1/courier/jobs/{jobId}/accept` | Accept assignment | Required |
| `POST` | `/api/v1/courier/jobs/{jobId}/pickup` | Mark picked up | Required |
| `POST` | `/api/v1/courier/jobs/{jobId}/dropoff` | Mark delivered | Required |
| `POST` | `/api/v1/courier/telemetry` | Upload telemetry | N/A |
| `POST` | `/api/v1/courier/orders/{orderId}/cash-collection` | Confirm cash collected | Required |
| `GET` | `/api/v1/courier/payouts` | List payout statements | N/A |

### 5.4 Admin And Support APIs

| Method | Path | Purpose | Idempotency |
|---|---|---|---|
| `POST` | `/api/v1/support/tickets` | Create support ticket | Required |
| `GET` | `/api/v1/support/tickets/{ticketId}/timeline` | Correlated support timeline | N/A |
| `POST` | `/api/v1/support/refunds` | Create refund request | Required |
| `POST` | `/api/v1/admin/payouts/generate` | Generate payout batch | Required |
| `POST` | `/api/v1/admin/risk/reviews/{reviewId}/resolve` | Resolve manual risk review | Required |

## 6. Internal gRPC Dispatch Contracts

Service: `dispatch.v1.DispatchService`

Methods:

- `Score(ScoreRequest) returns (ScoreResponse)`
- `Assign(AssignRequest) returns (AssignResponse)`
- `Reassign(ReassignRequest) returns (ReassignResponse)`
- `UpdateTelemetry(UpdateTelemetryRequest) returns (UpdateTelemetryResponse)`

Compatibility requirements:

- Only additive fields in existing messages.
- No reuse of field numbers.
- Default values must preserve old consumer behavior.

## 7. Event Contract Catalog

### 7.1 Envelope

```json
{
  "eventId": "uuid",
  "eventType": "order.created.v1",
  "eventVersion": 1,
  "occurredAt": "2026-02-16T20:15:30Z",
  "producer": "order-orchestration",
  "idempotencyKey": "string",
  "correlationId": "uuid",
  "payload": {}
}
```

### 7.2 Required Topics

| Topic | Producer | Primary Consumers | Key Payload Fields |
|---|---|---|---|
| `order.created.v1` | Order Orchestration | Payments, Dispatch, Notifications | `orderId`, `merchantId`, `consumerId`, `totals` |
| `order.confirmed.v1` | Order Orchestration | Dispatch, Notifications | `orderId`, `confirmedAt` |
| `order.cancelled.v1` | Order Orchestration | Payments, Settlement, Notifications | `orderId`, `reasonCode`, `cancelledBy` |
| `dispatch.assignment.requested.v1` | Order Orchestration | Dispatch | `orderId`, `pickup`, `dropoff`, `slaDeadline` |
| `dispatch.assignment.completed.v1` | Dispatch | Order Orchestration, Notifications | `orderId`, `assignmentId`, `mode`, `eta` |
| `payment.authorized.v1` | Payments | Order Orchestration, Risk | `orderId`, `paymentIntentId`, `amount` |
| `payment.captured.v1` | Payments | Settlement, Notifications | `orderId`, `paymentIntentId`, `capturedAmount` |
| `refund.completed.v1` | Payments | Settlement, Support, Notifications | `refundRequestId`, `orderId`, `amount` |
| `settlement.generated.v1` | Settlement | Finance Ops, Payout service | `settlementRecordId`, `orderId`, `balances` |
| `payout.released.v1` | Settlement | Merchant, Courier, Notifications | `payoutBatchId`, `entityId`, `amount` |

### 7.3 Event Reliability Rules

- At-least-once delivery over EventBridge/SQS.
- Consumers must be idempotent and side-effect safe.
- Poison messages move to DLQ with reason metadata.
- Replay tooling must support bounded reprocessing by time window and event type.

## 8. Versioning And Compatibility Policy

### 8.1 REST Policy

Allowed in `v1`:

- add optional request fields,
- add optional response fields,
- add new endpoints.

Not allowed in `v1`:

- remove or rename fields,
- change field semantics,
- change status code contract for existing success/error paths.

### 8.2 Event Policy

Allowed in `.v1`:

- add optional payload fields,
- add metadata fields to envelope.

Not allowed in `.v1`:

- remove required fields,
- change type or meaning of existing fields,
- alter ordering assumptions without explicit migration.

## 9. Contract Testing Requirements

### 9.1 REST Contract Tests

- OpenAPI schema validation for request/response payloads
- Backward compatibility checks against previous release specs
- Error schema conformance tests

### 9.2 gRPC Contract Tests

- Protobuf breaking-change detection
- Golden request/response compatibility tests
- Fallback behavior tests for missing optional fields

### 9.3 Event Contract Tests

- Schema compatibility checks by topic/version
- Idempotency replay tests (duplicate delivery)
- DLQ routing tests for malformed payloads

### 9.4 Release Gates

Production promotion is blocked if any contract test fails.

## 10. Security And Audit Requirements In Contracts

- Financial and privileged endpoints require:
  - `X-Idempotency-Key`,
  - actor identity claim,
  - action reason code where policy requires.
- Contract payloads containing sensitive fields must be classified and masked in logs.
- Contract changes impacting security controls require security review approval.

## 11. Traceability To FRD

Every contract entity and endpoint must map to at least one requirement in:

`/Users/romel/Documents/GitHub/FoodPanda/docs/requirements/functional-requirements-ddd.md`

Mapping examples:

- `FR-ORDERORCHESTRATION-001` -> `POST /api/v1/consumer/orders`
- `FR-DISPATCH-002` -> `dispatch.assignment.completed.v1`
- `FR-PAYMENTS-004` -> `POST /api/v1/support/refunds`
- `FR-PLATFORM-006` -> `AuditEvent` contract and immutable audit stream
