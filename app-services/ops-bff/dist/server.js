import Fastify from "fastify";
export function createOpsCoreApiDependencies(options) {
    const baseUrl = options.coreApiBaseUrl.replace(/\/+$/, "");
    const fetchImpl = options.fetchImpl ?? fetch;
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
    };
}
export function createOpsBffServer(dependencies) {
    const app = Fastify();
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
    app.get("/app/v1/admin/incidents", async () => {
        const incidents = await dependencies.listAdminIncidents();
        return { incidents };
    });
    return app;
}
export function createOpsBffServerFromEnv() {
    return createOpsBffServer(createOpsCoreApiDependencies({
        coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "http://127.0.0.1:3000",
    }));
}
//# sourceMappingURL=server.js.map