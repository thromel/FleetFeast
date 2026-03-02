import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";

import {
  createAppSessionAuthServiceFromEnv,
  createOidcVerifierFromEnv,
  extractRolesFromClaims,
  mapAppAuthError,
  type AppAccessTokenClaims,
  type AppSessionAuthService,
  type OidcVerifier,
} from "@fleetfeast/app-auth";
import type { AppPersona, AppRole } from "@fleetfeast/shared-contracts";

export interface MerchantOrderView {
  id: string;
  status: string;
}

export interface DispatchAssignmentCandidateInput {
  courierId: string;
  distanceMeters: number;
  available: boolean;
  activeOrders: number;
  withinRestWindow: boolean;
}

export interface RequestDispatchAssignmentInput {
  candidates: DispatchAssignmentCandidateInput[];
  slaPressure: number;
  merchantSelfDeliveryEnabled: boolean;
}

export interface MerchantPayoutStatementLineItemView {
  label: string;
  amount: number;
}

export interface MerchantPayoutStatementView {
  statementId: string;
  payoutBatchId: string;
  entityType: "MERCHANT";
  entityId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalAmount: number;
  lineItems: MerchantPayoutStatementLineItemView[];
  format: "PDF" | "PLAINTEXT";
  renderedContent: string;
  createdAt: string;
}

export interface AdminIncidentView {
  id: string;
  severity: string;
}

export interface AdminComplianceAuditEventView {
  auditEventId: string;
  actionType: string;
  actorId: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  previousHash: string;
  hash: string;
}

export interface AdminSloBreachView {
  type: "AVAILABILITY" | "LATENCY_CHECKOUT" | "LATENCY_TIMELINE";
  actual: number;
  threshold: number;
}

export interface AdminSloDashboardView {
  availabilityPercent: number;
  checkoutP95Ms: number;
  timelineP95Ms: number;
  breaches: AdminSloBreachView[];
}

export interface OpsFeatureFlagContext {
  userId: string;
  role: string;
  tenantId?: string;
}

export interface OpsFeatureFlagSnapshot {
  flags: Record<string, boolean>;
  ttlSeconds: number;
  generatedAtEpochMillis: number;
}

export interface OpsBffDependencies {
  listMerchantOrders(merchantId: string): Promise<MerchantOrderView[]>;
  acceptMerchantOrder(orderId: string): Promise<MerchantOrderView>;
  requestDispatchAssignment(
    orderId: string,
    input?: RequestDispatchAssignmentInput,
  ): Promise<MerchantOrderView>;
  listMerchantPayoutStatements(merchantId: string): Promise<MerchantPayoutStatementView[]>;
  listAdminIncidents(): Promise<AdminIncidentView[]>;
  listAdminComplianceAuditEvents(): Promise<AdminComplianceAuditEventView[]>;
  getAdminSloDashboard(): Promise<AdminSloDashboardView>;
  getMerchantFeatureFlagSnapshot(context: OpsFeatureFlagContext): Promise<OpsFeatureFlagSnapshot>;
  getAdminFeatureFlagSnapshot(context: OpsFeatureFlagContext): Promise<OpsFeatureFlagSnapshot>;
  oidcVerifier: OidcVerifier;
  sessionAuth: AppSessionAuthService;
}

export interface OpsCoreApiDependencyOptions {
  coreApiBaseUrl: string;
  fetchImpl?: typeof fetch;
}

export function createOpsCoreApiDependencies(
  options: OpsCoreApiDependencyOptions,
): Pick<
  OpsBffDependencies,
  | "acceptMerchantOrder"
  | "requestDispatchAssignment"
  | "listMerchantOrders"
  | "listMerchantPayoutStatements"
  | "listAdminIncidents"
  | "listAdminComplianceAuditEvents"
  | "getAdminSloDashboard"
  | "getMerchantFeatureFlagSnapshot"
  | "getAdminFeatureFlagSnapshot"
> {
  const baseUrl = options.coreApiBaseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const merchantFlags = parseFeatureFlagMap(process.env.MERCHANT_FEATURE_FLAGS_JSON, {
    "merchant.livePrepBoard": true,
  });
  const adminFlags = parseFeatureFlagMap(process.env.ADMIN_FEATURE_FLAGS_JSON, {
    "admin.incidentWorkbenchV2": false,
  });
  const ttlSeconds = parseFeatureFlagsTtlSeconds(process.env.OPS_FEATURE_FLAGS_TTL_SECONDS);

  return {
    async acceptMerchantOrder(orderId: string): Promise<MerchantOrderView> {
      const response = await fetchImpl(
        `${baseUrl}/api/v1/merchant/orders/${encodeURIComponent(orderId)}/accept`,
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        throw new Error("CORE_API_MERCHANT_ORDER_ACCEPT_FAILED");
      }

      const payload = (await response.json()) as { id: string; status: string };
      return {
        id: payload.id,
        status: payload.status,
      };
    },
    async requestDispatchAssignment(
      orderId: string,
      input?: RequestDispatchAssignmentInput,
    ): Promise<MerchantOrderView> {
      const response = await fetchImpl(
        `${baseUrl}/internal/orders/${encodeURIComponent(orderId)}/request-dispatch`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(input ?? {}),
        },
      );
      if (!response.ok) {
        throw new Error("CORE_API_DISPATCH_REQUEST_FAILED");
      }

      const payload = (await response.json()) as { id: string; status: string };
      return {
        id: payload.id,
        status: payload.status,
      };
    },
    async listMerchantOrders(merchantId: string): Promise<MerchantOrderView[]> {
      const response = await fetchImpl(
        `${baseUrl}/api/v1/merchant/orders?merchantId=${encodeURIComponent(merchantId)}`,
      );
      if (!response.ok) {
        throw new Error("CORE_API_MERCHANT_ORDERS_FETCH_FAILED");
      }

      const payload = (await response.json()) as {
        orders?: Array<{ id: string; status: string }>;
      };

      return (payload.orders ?? []).map((order) => ({
        id: order.id,
        status: order.status,
      }));
    },
    async listAdminIncidents(): Promise<AdminIncidentView[]> {
      const response = await fetchImpl(`${baseUrl}/internal/observability/logs`);
      if (!response.ok) {
        throw new Error("CORE_API_OBSERVABILITY_LOGS_FETCH_FAILED");
      }

      const payload = (await response.json()) as {
        logs?: Array<{ traceId: string; statusCode: number }>;
      };

      return (payload.logs ?? []).map((log) => ({
        id: log.traceId,
        severity: log.statusCode >= 500 ? "HIGH" : "LOW",
      }));
    },
    async listAdminComplianceAuditEvents(): Promise<AdminComplianceAuditEventView[]> {
      const response = await fetchImpl(`${baseUrl}/internal/risk/compliance/audit/events`);
      if (!response.ok) {
        throw new Error("CORE_API_COMPLIANCE_AUDIT_EVENTS_FETCH_FAILED");
      }

      const payload = (await response.json()) as {
        events?: AdminComplianceAuditEventView[];
      };

      return payload.events ?? [];
    },
    async getAdminSloDashboard(): Promise<AdminSloDashboardView> {
      const response = await fetchImpl(`${baseUrl}/internal/observability/slo/dashboard`);
      if (!response.ok) {
        throw new Error("CORE_API_SLO_DASHBOARD_FETCH_FAILED");
      }

      const payload = (await response.json()) as AdminSloDashboardView;
      return payload;
    },
    async listMerchantPayoutStatements(
      merchantId: string,
    ): Promise<MerchantPayoutStatementView[]> {
      const response = await fetchImpl(
        `${baseUrl}/api/v1/merchant/payouts?merchantId=${encodeURIComponent(merchantId)}`,
      );
      if (!response.ok) {
        throw new Error("CORE_API_MERCHANT_PAYOUTS_FETCH_FAILED");
      }

      const payload = (await response.json()) as {
        statements?: MerchantPayoutStatementView[];
      };

      return payload.statements ?? [];
    },
    async getMerchantFeatureFlagSnapshot(): Promise<OpsFeatureFlagSnapshot> {
      return {
        flags: merchantFlags,
        ttlSeconds,
        generatedAtEpochMillis: Date.now(),
      };
    },
    async getAdminFeatureFlagSnapshot(): Promise<OpsFeatureFlagSnapshot> {
      return {
        flags: adminFlags,
        ttlSeconds,
        generatedAtEpochMillis: Date.now(),
      };
    },
  };
}

const ADMIN_ROLE_PRIORITY: AppRole[] = ["system_admin", "support_agent", "finance_ops"];
const ADMIN_ALLOWED_ROLES: AppRole[] = ["system_admin", "support_agent", "finance_ops"];
const MERCHANT_ALLOWED_ROLES: AppRole[] = ["merchant_operator"];

function resolveMerchantRole(roles: string[]): AppRole | null {
  return roles.includes("merchant_operator") ? "merchant_operator" : null;
}

function resolveAdminRole(roles: string[]): AppRole | null {
  for (const role of ADMIN_ROLE_PRIORITY) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return null;
}

export function createOpsBffServer(dependencies: OpsBffDependencies): FastifyInstance {
  const app = Fastify();

  app.post("/app/v1/merchant/session/exchange", async (request, reply) => {
    const payload = request.body as {
      oidcToken?: unknown;
      traceId?: unknown;
      deviceId?: unknown;
    };

    if (
      typeof payload?.oidcToken !== "string" ||
      payload.oidcToken.trim().length === 0 ||
      typeof payload?.traceId !== "string" ||
      payload.traceId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_SESSION_EXCHANGE_PAYLOAD",
        message: "oidcToken and traceId are required",
      };
    }

    if (payload.deviceId !== undefined && typeof payload.deviceId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_DEVICE_ID",
        message: "deviceId must be a string when provided",
      };
    }

    try {
      const identity = await dependencies.oidcVerifier.verifyIdToken(payload.oidcToken);
      const roles = extractRolesFromClaims(identity.claims);
      const role = resolveMerchantRole(roles);
      if (!role) {
        reply.status(403);
        return {
          errorCode: "MERCHANT_ROLE_REQUIRED",
          message: "merchant_operator role is required for merchant session exchange",
        };
      }

      return dependencies.sessionAuth.issueSession({
        userId: identity.subject,
        role,
        persona: "merchant",
        traceId: payload.traceId,
        deviceId: payload.deviceId,
      });
    } catch (error: unknown) {
      const mapped = mapAppAuthError(error);
      if (mapped) {
        reply.status(mapped.statusCode);
        return {
          errorCode: mapped.errorCode,
          message: mapped.message,
        };
      }

      throw error;
    }
  });

  app.post("/app/v1/merchant/session/refresh", async (request, reply) => {
    const payload = request.body as {
      refreshToken?: unknown;
      traceId?: unknown;
      deviceId?: unknown;
    };

    if (
      typeof payload?.refreshToken !== "string" ||
      payload.refreshToken.trim().length === 0 ||
      typeof payload?.traceId !== "string" ||
      payload.traceId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_SESSION_REFRESH_PAYLOAD",
        message: "refreshToken and traceId are required",
      };
    }

    if (payload.deviceId !== undefined && typeof payload.deviceId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_DEVICE_ID",
        message: "deviceId must be a string when provided",
      };
    }

    try {
      return dependencies.sessionAuth.refreshSession({
        refreshToken: payload.refreshToken,
        traceId: payload.traceId,
        deviceId: payload.deviceId,
      });
    } catch (error: unknown) {
      const mapped = mapAppAuthError(error);
      if (mapped) {
        reply.status(mapped.statusCode);
        return {
          errorCode: mapped.errorCode,
          message: mapped.message,
        };
      }

      throw error;
    }
  });

  app.post("/app/v1/admin/session/exchange", async (request, reply) => {
    const payload = request.body as {
      oidcToken?: unknown;
      traceId?: unknown;
      deviceId?: unknown;
    };

    if (
      typeof payload?.oidcToken !== "string" ||
      payload.oidcToken.trim().length === 0 ||
      typeof payload?.traceId !== "string" ||
      payload.traceId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_SESSION_EXCHANGE_PAYLOAD",
        message: "oidcToken and traceId are required",
      };
    }

    if (payload.deviceId !== undefined && typeof payload.deviceId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_DEVICE_ID",
        message: "deviceId must be a string when provided",
      };
    }

    try {
      const identity = await dependencies.oidcVerifier.verifyIdToken(payload.oidcToken);
      const roles = extractRolesFromClaims(identity.claims);
      const role = resolveAdminRole(roles);
      if (!role) {
        reply.status(403);
        return {
          errorCode: "ADMIN_ROLE_REQUIRED",
          message: "admin role is required for admin session exchange",
        };
      }

      return dependencies.sessionAuth.issueSession({
        userId: identity.subject,
        role,
        persona: "admin",
        traceId: payload.traceId,
        deviceId: payload.deviceId,
      });
    } catch (error: unknown) {
      const mapped = mapAppAuthError(error);
      if (mapped) {
        reply.status(mapped.statusCode);
        return {
          errorCode: mapped.errorCode,
          message: mapped.message,
        };
      }

      throw error;
    }
  });

  app.post("/app/v1/admin/session/refresh", async (request, reply) => {
    const payload = request.body as {
      refreshToken?: unknown;
      traceId?: unknown;
      deviceId?: unknown;
    };

    if (
      typeof payload?.refreshToken !== "string" ||
      payload.refreshToken.trim().length === 0 ||
      typeof payload?.traceId !== "string" ||
      payload.traceId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_SESSION_REFRESH_PAYLOAD",
        message: "refreshToken and traceId are required",
      };
    }

    if (payload.deviceId !== undefined && typeof payload.deviceId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_DEVICE_ID",
        message: "deviceId must be a string when provided",
      };
    }

    try {
      return dependencies.sessionAuth.refreshSession({
        refreshToken: payload.refreshToken,
        traceId: payload.traceId,
        deviceId: payload.deviceId,
      });
    } catch (error: unknown) {
      const mapped = mapAppAuthError(error);
      if (mapped) {
        reply.status(mapped.statusCode);
        return {
          errorCode: mapped.errorCode,
          message: mapped.message,
        };
      }

      throw error;
    }
  });

  app.post("/app/v1/merchant/orders/:orderId/accept", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "merchant",
      allowedRoles: MERCHANT_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    const params = request.params as { orderId?: unknown };
    if (typeof params?.orderId !== "string" || params.orderId.trim().length === 0) {
      reply.status(400);
      return {
        errorCode: "INVALID_MERCHANT_ORDER_ROUTE_PARAM",
        message: "orderId route param is required",
      };
    }

    const order = await dependencies.acceptMerchantOrder(params.orderId);
    return { order };
  });

  app.post("/app/v1/merchant/orders/:orderId/request-dispatch", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "merchant",
      allowedRoles: MERCHANT_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    const params = request.params as { orderId?: unknown };
    if (typeof params?.orderId !== "string" || params.orderId.trim().length === 0) {
      reply.status(400);
      return {
        errorCode: "INVALID_MERCHANT_ORDER_ROUTE_PARAM",
        message: "orderId route param is required",
      };
    }

    const payload = request.body as unknown;
    if (payload !== undefined && (typeof payload !== "object" || payload === null)) {
      reply.status(400);
      return {
        errorCode: "INVALID_DISPATCH_REQUEST_PAYLOAD",
        message: "dispatch payload must be a JSON object when provided",
      };
    }

    const order = await dependencies.requestDispatchAssignment(
      params.orderId,
      payload as RequestDispatchAssignmentInput | undefined,
    );
    return { order };
  });

  app.get("/app/v1/merchant/orders", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "merchant",
      allowedRoles: MERCHANT_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    const query = request.query as { merchantId?: unknown };
    if (typeof query?.merchantId !== "string" || query.merchantId.trim().length === 0) {
      reply.status(400);
      return {
        errorCode: "INVALID_MERCHANT_QUERY",
        message: "merchantId query is required",
      };
    }

    const orders = await dependencies.listMerchantOrders(query.merchantId);
    return { orders };
  });

  app.get("/app/v1/merchant/payouts", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "merchant",
      allowedRoles: MERCHANT_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    const query = request.query as { merchantId?: unknown };
    if (typeof query?.merchantId !== "string" || query.merchantId.trim().length === 0) {
      reply.status(400);
      return {
        errorCode: "INVALID_MERCHANT_QUERY",
        message: "merchantId query is required",
      };
    }

    const statements = await dependencies.listMerchantPayoutStatements(query.merchantId);
    return { statements };
  });

  app.get("/app/v1/merchant/feature-flags", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "merchant",
      allowedRoles: MERCHANT_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    const query = request.query as { userId?: unknown; role?: unknown; tenantId?: unknown };
    if (
      typeof query?.userId !== "string" ||
      query.userId.trim().length === 0 ||
      typeof query?.role !== "string" ||
      query.role.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_FEATURE_FLAG_QUERY",
        message: "userId and role query params are required",
      };
    }

    if (query.tenantId !== undefined && typeof query.tenantId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_FEATURE_FLAG_QUERY",
        message: "tenantId must be a string when provided",
      };
    }
    if (query.userId !== claims.userId || query.role !== claims.role) {
      reply.status(403);
      return {
        errorCode: "APP_ROUTE_FORBIDDEN",
        message: "Session claims do not match feature-flag query context",
      };
    }

    return dependencies.getMerchantFeatureFlagSnapshot({
      userId: query.userId,
      role: query.role,
      tenantId: query.tenantId,
    });
  });

  app.get("/app/v1/admin/incidents", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "admin",
      allowedRoles: ADMIN_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    const incidents = await dependencies.listAdminIncidents();
    return { incidents };
  });

  app.get("/app/v1/admin/compliance/audit-events", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "admin",
      allowedRoles: ADMIN_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    const events = await dependencies.listAdminComplianceAuditEvents();
    return { events };
  });

  app.get("/app/v1/admin/slo-dashboard", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "admin",
      allowedRoles: ADMIN_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    return dependencies.getAdminSloDashboard();
  });

  app.get("/app/v1/admin/feature-flags", async (request, reply) => {
    const claims = await authorizeDataRoute(request.headers.authorization, reply, {
      persona: "admin",
      allowedRoles: ADMIN_ALLOWED_ROLES,
    });
    if (!claims) {
      return;
    }

    const query = request.query as { userId?: unknown; role?: unknown; tenantId?: unknown };
    if (
      typeof query?.userId !== "string" ||
      query.userId.trim().length === 0 ||
      typeof query?.role !== "string" ||
      query.role.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_FEATURE_FLAG_QUERY",
        message: "userId and role query params are required",
      };
    }

    if (query.tenantId !== undefined && typeof query.tenantId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_FEATURE_FLAG_QUERY",
        message: "tenantId must be a string when provided",
      };
    }
    if (query.userId !== claims.userId || query.role !== claims.role) {
      reply.status(403);
      return {
        errorCode: "APP_ROUTE_FORBIDDEN",
        message: "Session claims do not match feature-flag query context",
      };
    }

    return dependencies.getAdminFeatureFlagSnapshot({
      userId: query.userId,
      role: query.role,
      tenantId: query.tenantId,
    });
  });

  return app;

  async function authorizeDataRoute(
    authorizationHeader: string | undefined,
    reply: FastifyReply,
    policy: {
      persona: AppPersona;
      allowedRoles: AppRole[];
    },
  ): Promise<AppAccessTokenClaims | null> {
    const accessToken = extractBearerToken(authorizationHeader);
    if (!accessToken) {
      reply.status(401).send({
        errorCode: "APP_ACCESS_TOKEN_REQUIRED",
        message: "Bearer access token is required for app data routes",
      });
      return null;
    }

    try {
      const claims = await dependencies.sessionAuth.verifyAccessToken(accessToken);
      if (claims.persona !== policy.persona || !policy.allowedRoles.includes(claims.role)) {
        reply.status(403).send({
          errorCode: "APP_ROUTE_FORBIDDEN",
          message: "Session token does not have access to this route",
        });
        return null;
      }

      return claims;
    } catch (error: unknown) {
      const mapped = mapAppAuthError(error);
      if (mapped) {
        reply.status(mapped.statusCode).send({
          errorCode: mapped.errorCode,
          message: mapped.message,
        });
        return null;
      }

      throw error;
    }
  }
}

export function createOpsBffServerFromEnv(): FastifyInstance {
  return createOpsBffServer({
    ...createOpsCoreApiDependencies({
      coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "http://127.0.0.1:3000",
    }),
    oidcVerifier: createOidcVerifierFromEnv(process.env),
    sessionAuth: createAppSessionAuthServiceFromEnv(process.env),
  });
}

function parseFeatureFlagMap(
  rawFlags: string | undefined,
  defaultFlags: Record<string, boolean>,
): Record<string, boolean> {
  if (!rawFlags) {
    return { ...defaultFlags };
  }

  try {
    const parsed = JSON.parse(rawFlags) as Record<string, unknown>;
    const flags: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        flags[key] = value;
      }
    }

    return Object.keys(flags).length > 0 ? flags : { ...defaultFlags };
  } catch {
    return { ...defaultFlags };
  }
}

function parseFeatureFlagsTtlSeconds(rawTtlSeconds: string | undefined): number {
  const parsed = Number.parseInt(rawTtlSeconds ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }

  return parsed;
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const prefix = "Bearer ";
  if (!authorizationHeader.startsWith(prefix)) {
    return null;
  }

  const token = authorizationHeader.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}
