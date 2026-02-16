import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("POST /api/v1/merchant/stores/{id}/status updates store status and GET orderability reflects it", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const update = await fetch(`${baseUrl}/api/v1/merchant/stores/store-1/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paused: true,
        schedule: { open: "00:00", close: "23:59", timezone: "UTC" },
      }),
    });

    assert.equal(update.status, 200);

    const orderability = await fetch(
      `${baseUrl}/internal/catalog/stores/store-1/orderability?at=2026-02-16T12:00:00.000Z`,
    );

    assert.equal(orderability.status, 200);
    const payload = (await orderability.json()) as { orderable: boolean; reason: string };
    assert.equal(payload.orderable, false);
    assert.equal(payload.reason, "STORE_PAUSED");
  } finally {
    listener.close();
  }
});
