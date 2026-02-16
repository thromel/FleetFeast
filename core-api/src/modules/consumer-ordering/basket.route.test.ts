import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("basket routes create update and reject unavailable items", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const createResponse = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consumerId: "consumer-1",
        merchantId: "merchant-1",
        currency: "USD",
      }),
    });

    assert.equal(createResponse.status, 201);
    const basket = (await createResponse.json()) as { id: string };

    const updateResponse = await fetch(`${baseUrl}/api/v1/consumer/baskets/${basket.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            itemId: "item-1",
            name: "Burger",
            quantity: 1,
            unitPriceCents: 1299,
            modifiers: ["extra-cheese"],
            note: "no pickles",
          },
        ],
      }),
    });

    assert.equal(updateResponse.status, 200);

    await fetch(`${baseUrl}/api/v1/merchant/items/item-2/availability`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ available: false, reason: "OUT_OF_STOCK" }),
    });

    const unavailableUpdate = await fetch(`${baseUrl}/api/v1/consumer/baskets/${basket.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            itemId: "item-2",
            name: "Sold Out Burger",
            quantity: 1,
            unitPriceCents: 1599,
            modifiers: [],
          },
        ],
      }),
    });

    assert.equal(unavailableUpdate.status, 409);
    const unavailablePayload = (await unavailableUpdate.json()) as { errorCode: string };
    assert.equal(unavailablePayload.errorCode, "ORDERING_ITEM_UNAVAILABLE");
  } finally {
    listener.close();
  }
});
