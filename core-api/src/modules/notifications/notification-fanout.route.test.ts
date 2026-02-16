import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal fanout route queues notifications and enforces idempotency", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const requestBody = {
      eventType: "order.created.v1",
      entityId: "order-1",
      recipientId: "consumer-1",
    };

    const firstResponse = await fetch(`${baseUrl}/internal/notifications/fanout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    assert.equal(firstResponse.status, 202);
    const firstPayload = (await firstResponse.json()) as { queuedCount: number };
    assert.equal(firstPayload.queuedCount, 2);

    const secondResponse = await fetch(`${baseUrl}/internal/notifications/fanout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    assert.equal(secondResponse.status, 202);
    const secondPayload = (await secondResponse.json()) as { queuedCount: number };
    assert.equal(secondPayload.queuedCount, 0);
  } finally {
    listener.close();
  }
});
