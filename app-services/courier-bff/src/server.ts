import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import { createAppSession } from "@fleetfeast/shared-contracts";

export interface CourierJobView {
  jobId: string;
  orderId: string;
  status: string;
}

export interface CourierBffDependencies {
  listAvailableJobs(): Promise<CourierJobView[]>;
}

export function createCourierBffServer(
  dependencies: CourierBffDependencies,
): FastifyInstance {
  const app = Fastify();

  app.post("/app/v1/courier/session/exchange", async (request, reply) => {
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
