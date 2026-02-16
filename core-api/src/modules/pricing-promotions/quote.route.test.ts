import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("quote and promotion routes return expected responses", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const createBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consumerId: "consumer-1",
        merchantId: "merchant-1",
        currency: "USD",
      }),
    });

    const basket = (await createBasket.json()) as { id: string };

    await fetch(`${baseUrl}/api/v1/consumer/baskets/${basket.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            itemId: "item-1",
            name: "Burger",
            quantity: 2,
            unitPriceCents: 1299,
            modifiers: [],
          },
        ],
      }),
    });

    const quote = await fetch(`${baseUrl}/api/v1/consumer/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ basketId: basket.id, promoCode: "WELCOME10" }),
    });

    assert.equal(quote.status, 200);
    const quotePayload = (await quote.json()) as { totalCents: number; discountCents: number };
    assert.equal(quotePayload.discountCents, 260);
    assert.equal(quotePayload.totalCents, 3067);

    const promoEval = await fetch(`${baseUrl}/api/v1/consumer/promotions/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consumerId: "consumer-1",
        merchantId: "merchant-1",
        subtotalCents: 2598,
        promoCode: "NOT_A_PROMO",
      }),
    });

    assert.equal(promoEval.status, 200);
    const promoPayload = (await promoEval.json()) as { eligible: boolean; reason: string };
    assert.equal(promoPayload.eligible, false);
    assert.equal(promoPayload.reason, "PROMO_NOT_FOUND");
  } finally {
    listener.close();
  }
});
