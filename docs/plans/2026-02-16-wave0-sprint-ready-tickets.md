# Wave 0 Sprint-Ready Tickets (Sprints 1-2)

## Scope

- Source backlog: `/Users/romel/Documents/GitHub/FoodPanda/docs/plans/2026-02-16-food-delivery-implementation-backlog.md`
- Wave: `Wave 0 (Sprints 1-2)`
- Included stories:
  - `E01-S01` through `E01-S05`
  - `E02-S01`, `E02-S02`

## Assignee Roles

- `PLAT-ENG`: Platform engineer (infra + deployment)
- `DEVOPS-ENG`: CI/CD and release automation engineer
- `SEC-ENG`: Security/compliance engineer
- `BE-ENG-1`: Backend engineer (core platform)
- `BE-ENG-2`: Backend engineer (identity/auth)

## Sprint Allocation

### Sprint 1 (Foundation Setup)

- `E01-S01` Create mono-repo structure
- `E01-S02` Provision isolated dev/staging/prod foundations
- `E01-S04` Configure CI/CD quality and security gates

### Sprint 2 (Runtime + Security + Identity Baseline)

- `E01-S03` Provision runtime network and edge stack
- `E01-S05` Secrets and key management baseline
- `E02-S01` User registration and identity model
- `E02-S02` JWT session issuance with rotating refresh

## Ticket Details

## Ticket E01-S01

- Summary: Create mono-repo structure for `core-api`, `dispatch-engine`, shared contracts
- Priority: `P0`
- Story points: `3`
- Sprint: `Sprint 1`
- Assignee: `BE-ENG-1`
- Dependencies: `None`
- FR IDs: `FR-PLATFORM-008`

### Implementation Tasks

1. Create top-level folders: `core-api/`, `dispatch-engine/`, `contracts/`.
2. Add baseline README and ownership notes in each folder.
3. Add initial service entrypoints for TypeScript and Go.
4. Add shared contracts folder shape (`openapi/`, `protobuf/`, `events/`).

### Acceptance Tests

1. Running `find core-api dispatch-engine contracts -maxdepth 2 -type d` returns expected directory tree.
2. `dispatch-engine` Go entrypoint compiles with `go test ./...`.
3. Monorepo README documents the three components and intended ownership boundaries.

## Ticket E01-S02

- Summary: Provision `dev/staging/prod` isolated environment foundations via Terraform
- Priority: `P0`
- Story points: `8`
- Sprint: `Sprint 1`
- Assignee: `PLAT-ENG`
- Dependencies: `E01-S01`
- FR IDs: `FR-PLATFORM-008`

### Implementation Tasks

1. Create Terraform root stacks per environment (`dev`, `staging`, `prod`).
2. Define remote state strategy and naming conventions.
3. Implement baseline IAM boundaries and tagging policy.
4. Add environment-level variable files and validation checks.

### Acceptance Tests

1. `terraform validate` passes in each environment stack.
2. `terraform plan` for each environment executes without policy violations.
3. IAM policy tests confirm cross-environment access is denied by default.

## Ticket E01-S04

- Summary: Configure CI/CD pipeline with build, test, security, and deploy gates
- Priority: `P0`
- Story points: `8`
- Sprint: `Sprint 1`
- Assignee: `DEVOPS-ENG`
- Dependencies: `E01-S01`
- FR IDs: `FR-PLATFORM-003`, `FR-PLATFORM-008`

### Implementation Tasks

1. Create CI workflow for lint/unit/integration checks.
2. Add contract compatibility checks (REST/gRPC/event placeholder jobs initially).
3. Add security checks: SAST and dependency scan gates.
4. Add protected deployment workflow with environment approvals.

### Acceptance Tests

1. PR workflow fails when lint/tests fail and passes when all checks pass.
2. Security scan failure blocks merge.
3. Production deployment workflow requires explicit approval gate.

## Ticket E01-S03

- Summary: Provision ECS Fargate, ALB, CloudFront, WAF, and VPC baseline
- Priority: `P0`
- Story points: `8`
- Sprint: `Sprint 2`
- Assignee: `PLAT-ENG`
- Dependencies: `E01-S02`
- FR IDs: `FR-PLATFORM-001`, `FR-PLATFORM-002`

### Implementation Tasks

1. Create VPC, subnets, routing, NAT, and security groups.
2. Provision ALB with service target groups.
3. Provision ECS cluster/services placeholders for core and dispatch.
4. Place CloudFront and WAF in front of ingress path.

### Acceptance Tests

1. `terraform plan` shows full network and edge stack resources.
2. Health-check endpoint for placeholder service is reachable through ALB.
3. WAF blocked-request test rules are measurable in metrics.

## Ticket E01-S05

- Summary: Implement key and secrets management baseline (KMS + Secrets Manager)
- Priority: `P0`
- Story points: `5`
- Sprint: `Sprint 2`
- Assignee: `SEC-ENG`
- Dependencies: `E01-S02`
- FR IDs: `FR-PLATFORM-003`

### Implementation Tasks

1. Create environment-specific KMS keys and alias policy.
2. Create Secrets Manager namespaces and access policies.
3. Enforce secret retrieval via task role instead of plaintext config.
4. Add key/secret rotation policy documentation and checks.

### Acceptance Tests

1. Unauthorized principals cannot read secrets.
2. Services can retrieve only their scoped secrets.
3. Encryption-at-rest checks pass for configured data stores.

## Ticket E02-S01

- Summary: Implement user registration and identity model
- Priority: `P0`
- Story points: `5`
- Sprint: `Sprint 2`
- Assignee: `BE-ENG-2`
- Dependencies: `E01-S03`
- FR IDs: `FR-IDENTITY-001`

### Implementation Tasks

1. Create identity domain model and persistence schema.
2. Implement `POST /api/v1/identity/register`.
3. Enforce unique email/phone constraints with deterministic error handling.
4. Emit `identity.user_registered.v1` event.

### Acceptance Tests

1. New unique registration succeeds and persists expected fields.
2. Duplicate email/phone returns deterministic conflict error code.
3. Registration event is emitted once per successful registration.

## Ticket E02-S02

- Summary: Implement JWT session issuance with rotating refresh tokens
- Priority: `P0`
- Story points: `8`
- Sprint: `Sprint 2`
- Assignee: `BE-ENG-2`
- Dependencies: `E02-S01`
- FR IDs: `FR-IDENTITY-002`

### Implementation Tasks

1. Implement login endpoint with access and refresh token issuance.
2. Implement refresh endpoint with rotation and revocation chain.
3. Add replay detection and forced session invalidation.
4. Emit `identity.session_issued.v1` event.

### Acceptance Tests

1. Access + refresh token issuance succeeds for valid credentials.
2. Refresh token rotation invalidates the previous token.
3. Replay attempt on an old refresh token is rejected and logged.

## Cross-Ticket Verification Checklist

1. Each ticket references at least one `FR-*` requirement.
2. Each ticket has explicit acceptance tests.
3. Dependencies are acyclic and align with sprint ordering.
4. Security-sensitive tickets include policy/access tests.
