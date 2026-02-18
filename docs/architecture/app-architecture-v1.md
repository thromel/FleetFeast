# App Architecture V1 (FleetFeast)

Last updated: `2026-02-18`

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

## 2. Topology

### Client Layer

1. `apps/web-merchant` -> merchant operations UI
2. `apps/web-admin` -> admin/ops incident UI
3. mobile apps (planned): native iOS + Android with KMP shared core

### App Service Layer

1. `app-services/consumer-bff` exposes `/app/v1/consumer/*`
2. `app-services/courier-bff` exposes `/app/v1/courier/*`
3. `app-services/ops-bff` exposes `/app/v1/merchant/*` and `/app/v1/admin/*`
4. `app-services/realtime-gateway` exposes websocket `/app/v1/realtime/connect`

### Core Platform Layer

1. `core-api` (`/api/v1/*`, `/internal/*`)
2. `dispatch-engine` (gRPC internal dispatch integration)

## 3. Data and Call Flow

1. Web apps call only persona-specific BFF routes.
2. BFF adapters call `core-api` typed contracts.
3. No app client calls `core-api` directly.
4. Realtime gateway receives domain-aligned events and publishes to channel subscribers.

Current concrete adapter mappings:

1. `consumer-bff` -> `GET /api/v1/consumer/orders/{orderId}`
2. `courier-bff` -> `GET /api/v1/courier/jobs/available`
3. `ops-bff` -> `GET /api/v1/merchant/orders?merchantId=...`
4. `ops-bff` -> `GET /internal/observability/logs` (incident projection source)

## 4. Runtime Configuration

BFF and web services are environment-driven:

1. `CORE_API_BASE_URL` for BFFs (default `http://127.0.0.1:3000`)
2. `OPS_BFF_BASE_URL` for web apps (default `http://127.0.0.1:4103`)
3. fixed local ports in current dev stack:
   - `core-api`: `3000`
   - `consumer-bff`: `4101`
   - `courier-bff`: `4102`
   - `ops-bff`: `4103`
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
5. merchant web app
6. admin web app

Smoke endpoints:

1. `http://127.0.0.1:3001` (merchant web)
2. `http://127.0.0.1:3002` (admin web)
3. `http://127.0.0.1:3000/health` (core-api)

## 6. Testing and Gates

Implemented quality gates in this slice:

1. adapter unit/integration tests per web app (`src/lib/api.test.ts`)
2. adapter and endpoint tests for each BFF
3. realtime websocket route test
4. `npm run test:app-layer` as app-layer test gate

## 7. Remaining Work To Full V1

1. OIDC + PKCE provider-backed verification and refresh hardening
2. mobile app shells (consumer/courier) + KMP shared core
3. feature flags, push fallback (APNs/FCM), and offline queue semantics
4. e2e journey gates across all four surfaces
