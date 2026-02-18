import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import { createAppSession } from "@fleetfeast/shared-contracts";

export interface ConsumerOrderView {
  id: string;
  status: string;
  timelineVersion: number;
}

export interface ConsumerBffDependencies {
  getOrderById(orderId: string): Promise<ConsumerOrderView>;
}

export function createConsumerBffServer(
  dependencies: ConsumerBffDependencies,
): FastifyInstance {
  const app = Fastify();

  app.post("/app/v1/consumer/session/exchange", async (request, reply) => {
    const payload = request.body as {
      oidcToken?: unknown;
      userId?: unknown;
      traceId?: unknown;
    };

    if (
      typeof payload?.oidcToken !== "string" ||
      payload.oidcToken.trim().length === 0 ||
      typeof payload?.userId !== "string" ||
      payload.userId.trim().length === 0 ||
      typeof payload?.traceId !== "string" ||
      payload.traceId.trim().length === 0
    ) {
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
    const params = request.params as { orderId?: unknown };
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
