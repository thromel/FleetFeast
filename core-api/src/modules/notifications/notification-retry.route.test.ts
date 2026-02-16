import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal notification retry route schedules retry below max attempts", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/notifications/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notificationId: "notif-1",
        eventType: "order.created.v1",
        channel: "SMS",
        entityId: "order-1",
        currentAttempt: 1,
        errorCode: "SMS_TIMEOUT",
        retriable: true,
      }),
    });

    assert.equal(response.status, 202);
    const payload = (await response.json()) as { action: string };
    assert.equal(payload.action, "RETRY");
  } finally {
    listener.close();
  }
});

test("internal notification retry route writes DLQ decision at retry cap", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/notifications/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notificationId: "notif-2",
        eventType: "order.created.v1",
        channel: "PUSH",
        entityId: "order-2",
        currentAttempt: 3,
        errorCode: "PROVIDER_DOWN",
        retriable: true,
      }),
    });

    assert.equal(response.status, 202);
    const payload = (await response.json()) as { action: string };
    assert.equal(payload.action, "DLQ");
  } finally {
    listener.close();
  }
});
