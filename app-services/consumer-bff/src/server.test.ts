import assert from "node:assert/strict";
import test from "node:test";

import { createConsumerBffServer } from "./server.js";

test("consumer-bff exchanges OIDC token into app session", async () => {
  const app = createConsumerBffServer({
    getOrderById: async () => ({
      id: "order-1",
      status: "DISPATCH_PENDING",
      timelineVersion: 2,
    }),
  });
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind consumer-bff test listener");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/consumer/session/exchange`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oidcToken: "oidc-token-1",
          userId: "user-1",
          traceId: "trace-1",
        }),
      },
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      session: { persona: string; role: string; refreshTokenId: string };
    };

    assert.equal(payload.session.persona, "consumer");
    assert.equal(payload.session.role, "consumer");
    assert.ok(payload.session.refreshTokenId.length > 0);
  } finally {
    await app.close();
  }
});

test("consumer-bff serves consumer order details through adapter", async () => {
  const app = createConsumerBffServer({
    getOrderById: async (orderId) => ({
      id: orderId,
      status: "COURIER_ASSIGNED",
      timelineVersion: 3,
    }),
  });
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind consumer-bff test listener");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/consumer/orders/order-42`,
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { order: { id: string; status: string } };
    assert.equal(payload.order.id, "order-42");
    assert.equal(payload.order.status, "COURIER_ASSIGNED");
  } finally {
    await app.close();
  }
});
