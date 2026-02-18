import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { createAppSession } from "@fleetfeast/shared-contracts";
export function createConsumerCoreApiDependencies(options) {
    const baseUrl = options.coreApiBaseUrl.replace(/\/+$/, "");
    const fetchImpl = options.fetchImpl ?? fetch;
    return {
        async getOrderById(orderId) {
            const response = await fetchImpl(`${baseUrl}/api/v1/consumer/orders/${encodeURIComponent(orderId)}`);
            if (!response.ok) {
                throw new Error("CORE_API_CONSUMER_ORDER_FETCH_FAILED");
            }
            const payload = (await response.json());
            return {
                id: payload.id,
                status: payload.status,
                timelineVersion: typeof payload.timelineVersion === "number" ? payload.timelineVersion : 0,
            };
        },
    };
}
export function createConsumerBffServer(dependencies) {
    const app = Fastify();
    app.post("/app/v1/consumer/session/exchange", async (request, reply) => {
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
            role: "consumer",
            persona: "consumer",
            traceId: payload.traceId,
            refreshTokenId: randomUUID(),
            expiresInSeconds: 900,
        });
        return { session };
    });
    app.get("/app/v1/consumer/orders/:orderId", async (request, reply) => {
        const params = request.params;
        if (typeof params?.orderId !== "string" || params.orderId.trim().length === 0) {
            reply.status(400);
            return {
                errorCode: "INVALID_CONSUMER_ORDER_ROUTE_PARAM",
                message: "orderId is required",
            };
        }
        const order = await dependencies.getOrderById(params.orderId);
        return { order };
    });
    return app;
}
export function createConsumerBffServerFromEnv() {
    return createConsumerBffServer(createConsumerCoreApiDependencies({
        coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "http://127.0.0.1:3000",
    }));
}
//# sourceMappingURL=server.js.map