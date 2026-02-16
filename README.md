# FoodPanda Monorepo

This repository contains the implementation scaffold for a food delivery platform.

## Repository Structure

- `core-api/`: TypeScript modular core service (identity, ordering, payments, support, settlement).
- `dispatch-engine/`: Go service for assignment, courier telemetry, and ETA computation.
- `contracts/`: Shared API, gRPC, and event contract definitions.
- `docs/`: Requirements, architecture, deployment, and planning docs.

## Ownership Boundaries

- Core domain and API behavior lives in `core-api/`.
- Real-time dispatch and telemetry logic lives in `dispatch-engine/`.
- Shared schemas and versioned interfaces live in `contracts/`.

## Next Steps

1. Implement Terraform environment scaffolding (`E01-S02`).
2. Add CI/CD quality and security gates (`E01-S04`).
3. Wire service containers and deployment manifests.
