import Fastify, { type FastifyInstance } from "fastify";

import {
  createAppSessionAuthServiceFromEnv,
  createOidcVerifierFromEnv,
  extractRolesFromClaims,
  mapAppAuthError,
  type AppSessionAuthService,
  type OidcVerifier,
} from "@fleetfeast/app-auth";

export interface CourierJobView {
  jobId: string;
  orderId: string;
  status: string;
  courierId?: string | null;
}

export interface CourierFeatureFlagContext {
  userId: string;
  role: string;
  tenantId?: string;
}

export interface CourierFeatureFlagSnapshot {
  flags: Record<string, boolean>;
  ttlSeconds: number;
  generatedAtEpochMillis: number;
}

export interface CourierBffDependencies {
  listAvailableJobs(): Promise<CourierJobView[]>;
  acceptJob(jobId: string, courierId: string): Promise<CourierJobView>;
  pickupJob(jobId: string, courierId: string): Promise<CourierJobView>;
  dropoffJob(jobId: string, courierId: string): Promise<CourierJobView>;
  getFeatureFlagSnapshot(context: CourierFeatureFlagContext): Promise<CourierFeatureFlagSnapshot>;
  oidcVerifier: OidcVerifier;
  sessionAuth: AppSessionAuthService;
}

export interface CourierCoreApiDependencyOptions {
  coreApiBaseUrl: string;
  fetchImpl?: typeof fetch;
}

export function createCourierCoreApiDependencies(
  options: CourierCoreApiDependencyOptions,
): Pick<
  CourierBffDependencies,
  "listAvailableJobs" | "acceptJob" | "pickupJob" | "dropoffJob" | "getFeatureFlagSnapshot"
> {
  const baseUrl = options.coreApiBaseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const configuredFlags = parseCourierFeatureFlags(process.env.COURIER_FEATURE_FLAGS_JSON);
  const ttlSeconds = parseFeatureFlagsTtlSeconds(process.env.COURIER_FEATURE_FLAGS_TTL_SECONDS);

  return {
    async listAvailableJobs(): Promise<CourierJobView[]> {
      const response = await fetchImpl(`${baseUrl}/api/v1/courier/jobs/available`);
      if (!response.ok) {
        throw new Error("CORE_API_COURIER_AVAILABLE_JOBS_FETCH_FAILED");
      }

      const payload = (await response.json()) as {
        jobs?: Array<{ jobId: string; orderId: string; status: string }>;
      };

      return (payload.jobs ?? []).map((job) => ({
        jobId: job.jobId,
        orderId: job.orderId,
        status: job.status,
      }));
    },
    async acceptJob(jobId: string, courierId: string): Promise<CourierJobView> {
      const response = await fetchImpl(
        `${baseUrl}/api/v1/courier/jobs/${encodeURIComponent(jobId)}/accept`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ courierId }),
        },
      );
      if (!response.ok) {
        throw new Error("CORE_API_COURIER_ACCEPT_JOB_FAILED");
      }

      return (await response.json()) as CourierJobView;
    },
    async pickupJob(jobId: string, courierId: string): Promise<CourierJobView> {
      const response = await fetchImpl(
        `${baseUrl}/api/v1/courier/jobs/${encodeURIComponent(jobId)}/pickup`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ courierId }),
        },
      );
      if (!response.ok) {
        throw new Error("CORE_API_COURIER_PICKUP_JOB_FAILED");
      }

      return (await response.json()) as CourierJobView;
    },
    async dropoffJob(jobId: string, courierId: string): Promise<CourierJobView> {
      const response = await fetchImpl(
        `${baseUrl}/api/v1/courier/jobs/${encodeURIComponent(jobId)}/dropoff`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ courierId }),
        },
      );
      if (!response.ok) {
        throw new Error("CORE_API_COURIER_DROPOFF_JOB_FAILED");
      }

      return (await response.json()) as CourierJobView;
    },
    async getFeatureFlagSnapshot(): Promise<CourierFeatureFlagSnapshot> {
      return {
        flags: configuredFlags,
        ttlSeconds,
        generatedAtEpochMillis: Date.now(),
      };
    },
  };
}

export function createCourierBffServer(
  dependencies: CourierBffDependencies,
): FastifyInstance {
  const app = Fastify();

  app.post("/app/v1/courier/session/exchange", async (request, reply) => {
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
      if (roles.length > 0 && !roles.includes("courier")) {
        reply.status(403);
        return {
          errorCode: "COURIER_ROLE_REQUIRED",
          message: "OIDC identity does not include courier role",
        };
      }

      const sessionBundle = await dependencies.sessionAuth.issueSession({
        userId: identity.subject,
        role: "courier",
        persona: "courier",
        traceId: payload.traceId,
        deviceId: payload.deviceId,
      });

      return sessionBundle;
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

  app.post("/app/v1/courier/session/refresh", async (request, reply) => {
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
      const sessionBundle = await dependencies.sessionAuth.refreshSession({
        refreshToken: payload.refreshToken,
        traceId: payload.traceId,
        deviceId: payload.deviceId,
      });
      return sessionBundle;
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

  app.get("/app/v1/courier/jobs/available", async () => {
    const jobs = await dependencies.listAvailableJobs();
    return { jobs };
  });

  app.post("/app/v1/courier/jobs/:jobId/accept", async (request, reply) => {
    const params = request.params as { jobId?: unknown };
    const payload = request.body as { courierId?: unknown };
    if (
      typeof params?.jobId !== "string" ||
      params.jobId.trim().length === 0 ||
      typeof payload?.courierId !== "string" ||
      payload.courierId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_COURIER_JOB_ACTION_PAYLOAD",
        message: "jobId route param and courierId body field are required",
      };
    }

    const job = await dependencies.acceptJob(params.jobId, payload.courierId);
    return { job };
  });

  app.post("/app/v1/courier/jobs/:jobId/pickup", async (request, reply) => {
    const params = request.params as { jobId?: unknown };
    const payload = request.body as { courierId?: unknown };
    if (
      typeof params?.jobId !== "string" ||
      params.jobId.trim().length === 0 ||
      typeof payload?.courierId !== "string" ||
      payload.courierId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_COURIER_JOB_ACTION_PAYLOAD",
        message: "jobId route param and courierId body field are required",
      };
    }

    const job = await dependencies.pickupJob(params.jobId, payload.courierId);
    return { job };
  });

  app.post("/app/v1/courier/jobs/:jobId/dropoff", async (request, reply) => {
    const params = request.params as { jobId?: unknown };
    const payload = request.body as { courierId?: unknown };
    if (
      typeof params?.jobId !== "string" ||
      params.jobId.trim().length === 0 ||
      typeof payload?.courierId !== "string" ||
      payload.courierId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_COURIER_JOB_ACTION_PAYLOAD",
        message: "jobId route param and courierId body field are required",
      };
    }

    const job = await dependencies.dropoffJob(params.jobId, payload.courierId);
    return { job };
  });

  app.get("/app/v1/courier/feature-flags", async (request, reply) => {
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

    return dependencies.getFeatureFlagSnapshot({
      userId: query.userId,
      role: query.role,
      tenantId: query.tenantId,
    });
  });

  return app;
}

export function createCourierBffServerFromEnv(): FastifyInstance {
  return createCourierBffServer({
    ...createCourierCoreApiDependencies({
      coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "http://127.0.0.1:3000",
    }),
    oidcVerifier: createOidcVerifierFromEnv(process.env),
    sessionAuth: createAppSessionAuthServiceFromEnv(process.env),
  });
}

const DEFAULT_COURIER_FEATURE_FLAGS: Record<string, boolean> = {
  "courier.offlineReplay": true,
};

function parseCourierFeatureFlags(rawFlags: string | undefined): Record<string, boolean> {
  if (!rawFlags) {
    return { ...DEFAULT_COURIER_FEATURE_FLAGS };
  }

  try {
    const parsed = JSON.parse(rawFlags) as Record<string, unknown>;
    const flags: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        flags[key] = value;
      }
    }

    return Object.keys(flags).length > 0 ? flags : { ...DEFAULT_COURIER_FEATURE_FLAGS };
  } catch {
    return { ...DEFAULT_COURIER_FEATURE_FLAGS };
  }
}

function parseFeatureFlagsTtlSeconds(rawTtlSeconds: string | undefined): number {
  const parsed = Number.parseInt(rawTtlSeconds ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }

  return parsed;
}
