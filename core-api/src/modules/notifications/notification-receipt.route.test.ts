import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal notification receipts routes persist and return receipt history", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const createResponse = await fetch(`${baseUrl}/internal/notifications/receipts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notificationId: "notif-1",
        channel: "SMS",
        entityId: "order-1",
        status: "DELIVERED",
        providerMessageId: "provider-1",
      }),
    });

    assert.equal(createResponse.status, 201);

    const listResponse = await fetch(`${baseUrl}/internal/notifications/receipts?entityId=order-1`);
    assert.equal(listResponse.status, 200);

    const payload = (await listResponse.json()) as {
      receipts: Array<{ notificationId: string; status: string }>;
    };

    assert.equal(payload.receipts.length, 1);
    assert.equal(payload.receipts[0]?.notificationId, "notif-1");
    assert.equal(payload.receipts[0]?.status, "DELIVERED");
  } finally {
    listener.close();
  }
});

test("internal notification receipts route rejects missing entityId query", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/notifications/receipts`);

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
