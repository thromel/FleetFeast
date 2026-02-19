import Fastify from "fastify";
import { createAppSessionAuthServiceFromEnv, createOidcVerifierFromEnv, extractRolesFromClaims, mapAppAuthError, } from "@fleetfeast/app-auth";
export function createOpsCoreApiDependencies(options) {
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
        async listMerchantOrders(merchantId) {
            const response = await fetchImpl(`${baseUrl}/api/v1/merchant/orders?merchantId=${encodeURIComponent(merchantId)}`);
            if (!response.ok) {
                throw new Error("CORE_API_MERCHANT_ORDERS_FETCH_FAILED");
            }
            const payload = (await response.json());
            return (payload.orders ?? []).map((order) => ({
                id: order.id,
                status: order.status,
            }));
        },
        async listAdminIncidents() {
            const response = await fetchImpl(`${baseUrl}/internal/observability/logs`);
            if (!response.ok) {
                throw new Error("CORE_API_OBSERVABILITY_LOGS_FETCH_FAILED");
            }
            const payload = (await response.json());
            return (payload.logs ?? []).map((log) => ({
                id: log.traceId,
                severity: log.statusCode >= 500 ? "HIGH" : "LOW",
            }));
        },
        async getMerchantFeatureFlagSnapshot() {
            return {
                flags: merchantFlags,
                ttlSeconds,
                generatedAtEpochMillis: Date.now(),
            };
        },
        async getAdminFeatureFlagSnapshot() {
            return {
                flags: adminFlags,
                ttlSeconds,
                generatedAtEpochMillis: Date.now(),
            };
        },
    };
}
const ADMIN_ROLE_PRIORITY = ["system_admin", "support_agent", "finance_ops"];
function resolveMerchantRole(roles) {
    return roles.includes("merchant_operator") ? "merchant_operator" : null;
}
function resolveAdminRole(roles) {
    for (const role of ADMIN_ROLE_PRIORITY) {
        if (roles.includes(role)) {
            return role;
        }
    }
    return null;
}
export function createOpsBffServer(dependencies) {
    const app = Fastify();
    app.post("/app/v1/merchant/session/exchange", async (request, reply) => {
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
    app.post("/app/v1/merchant/session/refresh", async (request, reply) => {
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
            return dependencies.sessionAuth.refreshSession({
                refreshToken: payload.refreshToken,
                traceId: payload.traceId,
                deviceId: payload.deviceId,
            });
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
    app.post("/app/v1/admin/session/exchange", async (request, reply) => {
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
    app.post("/app/v1/admin/session/refresh", async (request, reply) => {
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
            return dependencies.sessionAuth.refreshSession({
                refreshToken: payload.refreshToken,
                traceId: payload.traceId,
                deviceId: payload.deviceId,
            });
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
    app.get("/app/v1/merchant/orders", async (request, reply) => {
        const query = request.query;
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
    app.get("/app/v1/merchant/feature-flags", async (request, reply) => {
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
        return dependencies.getMerchantFeatureFlagSnapshot({
            userId: query.userId,
            role: query.role,
            tenantId: query.tenantId,
        });
    });
    app.get("/app/v1/admin/incidents", async () => {
        const incidents = await dependencies.listAdminIncidents();
        return { incidents };
    });
    app.get("/app/v1/admin/feature-flags", async (request, reply) => {
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
        return dependencies.getAdminFeatureFlagSnapshot({
            userId: query.userId,
            role: query.role,
            tenantId: query.tenantId,
        });
    });
    return app;
}
export function createOpsBffServerFromEnv() {
    return createOpsBffServer({
        ...createOpsCoreApiDependencies({
            coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "http://127.0.0.1:3000",
        }),
        oidcVerifier: createOidcVerifierFromEnv(process.env),
        sessionAuth: createAppSessionAuthServiceFromEnv(process.env),
    });
}
function parseFeatureFlagMap(rawFlags, defaultFlags) {
    if (!rawFlags) {
        return { ...defaultFlags };
    }
    try {
        const parsed = JSON.parse(rawFlags);
        const flags = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "boolean") {
                flags[key] = value;
            }
        }
        return Object.keys(flags).length > 0 ? flags : { ...defaultFlags };
    }
    catch {
        return { ...defaultFlags };
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