import Fastify from "fastify";
import { createAppSessionAuthServiceFromEnv, createOidcVerifierFromEnv, extractRolesFromClaims, mapAppAuthError, } from "@fleetfeast/app-auth";
export function createCourierCoreApiDependencies(options) {
    const baseUrl = options.coreApiBaseUrl.replace(/\/+$/, "");
    const fetchImpl = options.fetchImpl ?? fetch;
    const configuredFlags = parseCourierFeatureFlags(process.env.COURIER_FEATURE_FLAGS_JSON);
    const ttlSeconds = parseFeatureFlagsTtlSeconds(process.env.COURIER_FEATURE_FLAGS_TTL_SECONDS);
    return {
        async listAvailableJobs() {
            const response = await fetchImpl(`${baseUrl}/api/v1/courier/jobs/available`);
            if (!response.ok) {
                throw new Error("CORE_API_COURIER_AVAILABLE_JOBS_FETCH_FAILED");
            }
            const payload = (await response.json());
            return (payload.jobs ?? []).map((job) => ({
                jobId: job.jobId,
                orderId: job.orderId,
                status: job.status,
            }));
        },
        async acceptJob(jobId, courierId) {
            const response = await fetchImpl(`${baseUrl}/api/v1/courier/jobs/${encodeURIComponent(jobId)}/accept`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ courierId }),
            });
            if (!response.ok) {
                throw new Error("CORE_API_COURIER_ACCEPT_JOB_FAILED");
            }
            return (await response.json());
        },
        async pickupJob(jobId, courierId) {
            const response = await fetchImpl(`${baseUrl}/api/v1/courier/jobs/${encodeURIComponent(jobId)}/pickup`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ courierId }),
            });
            if (!response.ok) {
                throw new Error("CORE_API_COURIER_PICKUP_JOB_FAILED");
            }
            return (await response.json());
        },
        async dropoffJob(jobId, courierId) {
            const response = await fetchImpl(`${baseUrl}/api/v1/courier/jobs/${encodeURIComponent(jobId)}/dropoff`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ courierId }),
            });
            if (!response.ok) {
                throw new Error("CORE_API_COURIER_DROPOFF_JOB_FAILED");
            }
            return (await response.json());
        },
        async getFeatureFlagSnapshot() {
            return {
                flags: configuredFlags,
                ttlSeconds,
                generatedAtEpochMillis: Date.now(),
            };
        },
    };
}
export function createCourierBffServer(dependencies) {
    const app = Fastify();
    app.post("/app/v1/courier/session/exchange", async (request, reply) => {
        const payload = request.body;
        if (typeof payload?.oidcToken !== "string" ||
            payload.oidcToken.trim().length === 0 ||
            typeof payload?.traceId !== "string" ||
            payload.traceId.trim().length === 0) {
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
        }
        catch (error) {
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
        const payload = request.body;
        if (typeof payload?.refreshToken !== "string" ||
            payload.refreshToken.trim().length === 0 ||
            typeof payload?.traceId !== "string" ||
            payload.traceId.trim().length === 0) {
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
        }
        catch (error) {
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
        const params = request.params;
        const payload = request.body;
        if (typeof params?.jobId !== "string" ||
            params.jobId.trim().length === 0 ||
            typeof payload?.courierId !== "string" ||
            payload.courierId.trim().length === 0) {
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
        const params = request.params;
        const payload = request.body;
        if (typeof params?.jobId !== "string" ||
            params.jobId.trim().length === 0 ||
            typeof payload?.courierId !== "string" ||
            payload.courierId.trim().length === 0) {
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
        const params = request.params;
        const payload = request.body;
        if (typeof params?.jobId !== "string" ||
            params.jobId.trim().length === 0 ||
            typeof payload?.courierId !== "string" ||
            payload.courierId.trim().length === 0) {
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
        const query = request.query;
        if (typeof query?.userId !== "string" ||
            query.userId.trim().length === 0 ||
            typeof query?.role !== "string" ||
            query.role.trim().length === 0) {
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
export function createCourierBffServerFromEnv() {
    return createCourierBffServer({
        ...createCourierCoreApiDependencies({
            coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "http://127.0.0.1:3000",
        }),
        oidcVerifier: createOidcVerifierFromEnv(process.env),
        sessionAuth: createAppSessionAuthServiceFromEnv(process.env),
    });
}
const DEFAULT_COURIER_FEATURE_FLAGS = {
    "courier.offlineReplay": true,
};
function parseCourierFeatureFlags(rawFlags) {
    if (!rawFlags) {
        return { ...DEFAULT_COURIER_FEATURE_FLAGS };
    }
    try {
        const parsed = JSON.parse(rawFlags);
        const flags = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "boolean") {
                flags[key] = value;
            }
        }
        return Object.keys(flags).length > 0 ? flags : { ...DEFAULT_COURIER_FEATURE_FLAGS };
    }
    catch {
        return { ...DEFAULT_COURIER_FEATURE_FLAGS };
    }
}
function parseFeatureFlagsTtlSeconds(rawTtlSeconds) {
    const parsed = Number.parseInt(rawTtlSeconds ?? "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 30;
    }
    return parsed;
}
//# sourceMappingURL=server.js.map