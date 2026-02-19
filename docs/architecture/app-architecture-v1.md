# App Architecture V1 (FleetFeast)

Last updated: `2026-02-19`

## 1. Scope

This document defines the V1 app-layer topology that sits on top of the existing backend (`core-api` + `dispatch-engine`) and is delivered as an additive monorepo extension.

V1 app surfaces:

1. `consumer` mobile app
2. `courier` mobile app
3. `merchant` web app
4. `admin` web app

Current implemented slice:

1. `merchant` and `admin` web apps (Next.js App Router)
2. persona BFFs (`consumer-bff`, `courier-bff`, `ops-bff`)
3. `realtime-gateway` websocket baseline
4. OIDC-backed app-session exchange with rotating refresh tokens in BFF layer
5. push fallback with provider-specific APNs/FCM adapters in realtime gateway
6. internal realtime publish endpoint for channel fanout (`/app/v1/realtime/publish`)
7. mobile scaffold with `apps/mobile/shared-kmp` (contracts + offline queue + queue-store rehydration + JVM file-backed persistent store + typed BFF/realtime clients + feature-flag caching client + HTTP transport adapter boundary + default JSON body mapper + JVM HTTP executor + courier replay workflow service + persona-wide remote feature-flag snapshot support + persona startup bootstrap orchestrators), Kotlin Android shell modules, and Swift Package iOS shells

## 2. Topology

### Client Layer

1. `apps/web-merchant` -> merchant operations UI
2. `apps/web-admin` -> admin/ops incident UI
3. `apps/mobile/shared-kmp` -> Kotlin Multiplatform shared contracts/offline queue/typed BFF client core
4. `apps/mobile/consumer-android` and `apps/mobile/courier-android` -> Kotlin Android shell module baselines with Gradle tests
5. `apps/mobile/consumer-ios` and `apps/mobile/courier-ios` -> Swift Package iOS shell baselines with unit tests

### App Service Layer

1. `app-services/consumer-bff` exposes `/app/v1/consumer/*`
2. `app-services/courier-bff` exposes `/app/v1/courier/*`
3. `app-services/ops-bff` exposes `/app/v1/merchant/*` and `/app/v1/admin/*`
4. `app-services/realtime-gateway` exposes websocket `/app/v1/realtime/connect`
5. `app-services/realtime-gateway` exposes push registration routes:
   - `POST /app/v1/realtime/push/register`
   - `POST /app/v1/realtime/push/unregister`
6. `app-services/realtime-gateway` exposes internal fanout publish route:
   - `POST /app/v1/realtime/publish`
7. `app-services/courier-bff` exposes feature flag snapshot route:
   - `GET /app/v1/courier/feature-flags`
8. `app-services/consumer-bff` exposes feature flag snapshot route:
   - `GET /app/v1/consumer/feature-flags`
9. `app-services/ops-bff` exposes feature flag snapshot routes:
   - `GET /app/v1/merchant/feature-flags`
   - `GET /app/v1/admin/feature-flags`

### Core Platform Layer

1. `core-api` (`/api/v1/*`, `/internal/*`)
2. `dispatch-engine` (gRPC internal dispatch integration)

## 3. Data and Call Flow

1. Web apps call only persona-specific BFF routes.
2. BFF adapters call `core-api` typed contracts.
3. No app client calls `core-api` directly.
4. Realtime gateway receives domain-aligned events and publishes to channel subscribers.
5. When no websocket subscriber exists for a channel, realtime gateway sends push fallback via provider adapters.
6. Mobile clients consume BFF/realtime through typed `shared-kmp` adapters over an abstract transport boundary (`BffTransport`).
7. `shared-kmp` includes an HTTP transport adapter (`HttpBffTransport`) that converts typed requests into URL/query/header/body HTTP calls through injectable executor/mapper interfaces.
8. current shared-kmp baseline now includes `DefaultJsonHttpBodyMapper` and `JvmHttpTransportExecutor` so typed clients can call live BFF endpoints through concrete transport on JVM.
9. consumer/courier shared-kmp flow now supports remote feature flag snapshots via `ConsumerBffClient.getFeatureFlags`/`CourierBffClient.getFeatureFlags` and corresponding snapshot source adapters.
10. ops shared-kmp flow now supports remote feature flag snapshots via `OpsBffClient.getMerchantFeatureFlags` and `OpsBffClient.getAdminFeatureFlags`.
11. shared-kmp now includes `JvmJsonFileOfflineActionStore` for durable offline queue persistence in local JVM flows.
12. shared-kmp bootstrap orchestrators (`ConsumerAppBootstrap`, `CourierAppBootstrap`, `OpsAppBootstrap`) provide startup hydration flows for session + initial data.

Current concrete adapter mappings:

1. `consumer-bff` -> `GET /api/v1/consumer/orders/{orderId}`
2. `courier-bff` -> `GET /api/v1/courier/jobs/available`
3. `ops-bff` -> `GET /api/v1/merchant/orders?merchantId=...`
4. `ops-bff` -> `GET /internal/observability/logs` (incident projection source)
5. `courier-bff` -> `GET /app/v1/courier/feature-flags?userId=...&role=...`
6. `consumer-bff` -> `GET /app/v1/consumer/feature-flags?userId=...&role=...`
7. `ops-bff` -> `GET /app/v1/merchant/feature-flags?userId=...&role=...`
8. `ops-bff` -> `GET /app/v1/admin/feature-flags?userId=...&role=...`

Session endpoints:

1. `POST /app/v1/consumer/session/exchange` and `POST /app/v1/consumer/session/refresh`
2. `POST /app/v1/courier/session/exchange` and `POST /app/v1/courier/session/refresh`
3. `POST /app/v1/merchant/session/exchange` and `POST /app/v1/merchant/session/refresh`
4. `POST /app/v1/admin/session/exchange` and `POST /app/v1/admin/session/refresh`

## 4. Runtime Configuration

BFF and web services are environment-driven:

1. `CORE_API_BASE_URL` for BFFs (default `http://127.0.0.1:3000`)
2. `OPS_BFF_BASE_URL` for web apps (default `http://127.0.0.1:4103`)
3. `APP_SESSION_JWT_SECRET` for BFF-issued app session JWT signing
4. `OIDC_JWKS_URI`, `OIDC_ISSUER`, `OIDC_AUDIENCE` for provider-backed OIDC token verification (`dev:*` verifier fallback when unset)
5. `APNS_PUSH_ENDPOINT`, `APNS_PUSH_AUTH_TOKEN`, `FCM_PUSH_ENDPOINT`, `FCM_PUSH_AUTH_TOKEN` for push fallback provider adapters
6. `REALTIME_PUBLISH_API_KEY` optional shared key for `/app/v1/realtime/publish`
7. fixed local ports in current dev stack:
   - `core-api`: `3000`
   - `consumer-bff`: `4101`
   - `courier-bff`: `4102`
   - `ops-bff`: `4103`
   - `realtime-gateway`: `4104`
   - `web-merchant`: `3001`
   - `web-admin`: `3002`

## 5. Local Runnable Stack

Single command:

```bash
npm run dev:web-stack
```

What it starts:

1. `core-api`
2. `consumer-bff`
3. `courier-bff`
4. `ops-bff`
5. `realtime-gateway`
6. merchant web app
7. admin web app

Smoke endpoints:

1. `http://127.0.0.1:3001` (merchant web)
2. `http://127.0.0.1:3002` (admin web)
3. `http://127.0.0.1:3000/health` (core-api)
4. `http://127.0.0.1:4104/app/v1/realtime/connect` (websocket upgrade endpoint)

## 6. Testing and Gates

Implemented quality gates in this slice:

1. adapter unit/integration tests per web app (`src/lib/api.test.ts`)
2. adapter and endpoint tests for each BFF
3. realtime websocket + publish route tests
4. provider adapter tests for APNs/FCM payload routing
5. `npm run test:app-layer` as app-layer test gate
6. `npm run test:mobile-shared-kmp` as KMP shared-core gate (Docker Gradle `jvmTest`)
7. shared-kmp typed client tests for consumer/courier/ops/realtime route and payload mapping
8. shared-kmp JVM integration tests for JSON mapping and live HTTP round-trip using `JvmHttpTransportExecutor`
9. consumer/courier/ops feature-flag integration tests across BFF routes and shared-kmp client query mapping/source adapters
10. shared-kmp JVM file-store tests for empty-state load, JSON round-trip persistence, and queue rehydration via `PersistentOfflineActionQueue`
11. shared-kmp app-bootstrap tests validating ordered startup hydration for consumer, courier, merchant, and admin personas
12. iOS shell package tests via `npm run test:mobile-ios-shells` (`swift test` for consumer and courier modules)
13. Android shell module tests via `npm run test:mobile-android-shells` (Gradle `test` in consumer/courier modules)

## 7. Remaining Work To Full V1

1. full native mobile app project wiring for Android (Compose app targets + build pipelines consuming the shell modules) and SwiftUI app targets that consume the iOS shell packages
2. shared-kmp expansion: cross-platform production persistence implementation (e.g., SQLDelight) and Android/iOS concrete transport implementations aligned to platform networking stacks
3. backend event-bus to realtime-gateway publish integration hardening
4. e2e journey gates across all four surfaces
