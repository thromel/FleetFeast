import Fastify from "fastify";
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
//# sourceMappingURL=server.js.map