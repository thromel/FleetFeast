import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("POST /api/v1/merchant/items/{id}/availability updates and GET retrieves status", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const update = await fetch(`${baseUrl}/api/v1/merchant/items/item-1/availability`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ available: false, reason: "OUT_OF_STOCK" }),
    });

    assert.equal(update.status, 200);

    const read = await fetch(`${baseUrl}/internal/catalog/items/item-1/availability`);
    assert.equal(read.status, 200);

    const payload = (await read.json()) as {
      itemId: string;
      available: boolean;
      reason: string | null;
    };

    assert.equal(payload.itemId, "item-1");
    assert.equal(payload.available, false);
    assert.equal(payload.reason, "OUT_OF_STOCK");
  } finally {
    listener.close();
  }
});
