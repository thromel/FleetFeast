import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("GET /internal/catalog/stores/{id}/prep-time returns fallback and derived values", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const fallback = await fetch(`${baseUrl}/internal/catalog/stores/store-x/prep-time`);
    assert.equal(fallback.status, 200);
    const fallbackPayload = (await fallback.json()) as { estimatedMinutes: number; source: string };
    assert.equal(fallbackPayload.estimatedMinutes, 20);
    assert.equal(fallbackPayload.source, "DEFAULT_FALLBACK");

    await fetch(`${baseUrl}/api/v1/merchant/catalog/menus`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchantId: "merchant-1",
        storeId: "store-1",
        name: "Prep Menu",
        items: [
          { itemId: "item-1", name: "Burger", priceCents: 1299 },
          { itemId: "item-2", name: "Fries", priceCents: 499 },
          { itemId: "item-3", name: "Shake", priceCents: 699 },
        ],
      }),
    });

    const derived = await fetch(`${baseUrl}/internal/catalog/stores/store-1/prep-time`);
    assert.equal(derived.status, 200);
    const derivedPayload = (await derived.json()) as { estimatedMinutes: number; source: string };
    assert.equal(derivedPayload.estimatedMinutes, 16);
    assert.equal(derivedPayload.source, "CATALOG_HEURISTIC");
  } finally {
    listener.close();
  }
});
