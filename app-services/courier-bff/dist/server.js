import Fastify from "fastify";
import { createAppSessionAuthServiceFromEnv, createOidcVerifierFromEnv, extractRolesFromClaims, mapAppAuthError, } from "@fleetfeast/app-auth";
export function createCourierCoreApiDependencies(options) {
    const baseUrl = options.coreApiBaseUrl.replace(/\/+$/, "");
    const fetchImpl = options.fetchImpl ?? fetch;
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
//# sourceMappingURL=server.js.map