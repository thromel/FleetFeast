import Fastify, { type FastifyInstance } from "fastify";

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
}

export function createOpsBffServer(dependencies: OpsBffDependencies): FastifyInstance {
  const app = Fastify();

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
