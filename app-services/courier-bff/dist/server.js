import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { createAppSession } from "@fleetfeast/shared-contracts";
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
            typeof payload?.userId !== "string" ||
            payload.userId.trim().length === 0 ||
            typeof payload?.traceId !== "string" ||
            payload.traceId.trim().length === 0) {
            reply.status(400);
            return {
                errorCode: "INVALID_APP_SESSION_EXCHANGE_PAYLOAD",
                message: "oidcToken, userId, and traceId are required",
            };
        }
        const session = createAppSession({
            sessionId: randomUUID(),
            userId: payload.userId,
            role: "courier",
            persona: "courier",
            traceId: payload.traceId,
            refreshTokenId: randomUUID(),
            expiresInSeconds: 900,
        });
        return { session };
    });
    app.get("/app/v1/courier/jobs/available", async () => {
        const jobs = await dependencies.listAvailableJobs();
        return { jobs };
    });
    return app;
}
export function createCourierBffServerFromEnv() {
    return createCourierBffServer(createCourierCoreApiDependencies({
        coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "http://127.0.0.1:3000",
    }));
}
//# sourceMappingURL=server.js.map