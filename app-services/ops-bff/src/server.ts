import Fastify, { type FastifyInstance } from "fastify";

import {
  createAppSessionAuthServiceFromEnv,
  createOidcVerifierFromEnv,
  extractRolesFromClaims,
  mapAppAuthError,
  type AppSessionAuthService,
  type OidcVerifier,
} from "@fleetfeast/app-auth";
import type { AppRole } from "@fleetfeast/shared-contracts";

export interface MerchantOrderView {
  id: string;
  status: string;
}

export interface AdminIncidentView {
  id: string;
  severity: string;
}

export interface OpsBffDependencies {
  listMerchantOrders(merchantId: string): Promise<MerchantOrderView[]>;
  listAdminIncidents(): Promise<AdminIncidentView[]>;
  oidcVerifier: OidcVerifier;
  sessionAuth: AppSessionAuthService;
}

export interface OpsCoreApiDependencyOptions {
  coreApiBaseUrl: string;
  fetchImpl?: typeof fetch;
}

export function createOpsCoreApiDependencies(
  options: OpsCoreApiDependencyOptions,
): Pick<OpsBffDependencies, "listMerchantOrders" | "listAdminIncidents"> {
  const baseUrl = options.coreApiBaseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
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
  };
}

const ADMIN_ROLE_PRIORITY: AppRole[] = ["system_admin", "support_agent", "finance_ops"];

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

  app.get("/app/v1/merchant/orders", async (request, reply) => {
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

  app.get("/app/v1/admin/incidents", async () => {
    const incidents = await dependencies.listAdminIncidents();
    return { incidents };
  });

  return app;
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
