import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function createBasketAndQuote(baseUrl: string) {
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

  const quoteResponse = await fetch(`${baseUrl}/api/v1/consumer/quotes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ basketId: basket.id, promoCode: "WELCOME10" }),
  });

  const quote = (await quoteResponse.json()) as {
    quoteId: string;
    quoteHash: string;
    basketId: string;
  };

  return { basket, quote };
}

test("POST /api/v1/consumer/checkout accepts valid quote snapshot", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const { quote } = await createBasketAndQuote(baseUrl);

    const checkout = await fetch(`${baseUrl}/api/v1/consumer/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basketId: quote.basketId,
        quoteId: quote.quoteId,
        quoteHash: quote.quoteHash,
      }),
    });

    assert.equal(checkout.status, 200);
    const payload = (await checkout.json()) as {
      checkoutId: string;
      quoteId: string;
      quoteHash: string;
    };

    assert.ok(payload.checkoutId.length > 0);
    assert.equal(payload.quoteId, quote.quoteId);
    assert.equal(payload.quoteHash, quote.quoteHash);
  } finally {
    listener.close();
  }
});

test("POST /api/v1/consumer/checkout rejects stale quote hash", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const { quote } = await createBasketAndQuote(baseUrl);

    const checkout = await fetch(`${baseUrl}/api/v1/consumer/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        basketId: quote.basketId,
        quoteId: quote.quoteId,
        quoteHash: "tampered-hash",
      }),
    });

    assert.equal(checkout.status, 409);
    const payload = (await checkout.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "ORDERING_STALE_QUOTE");
  } finally {
    listener.close();
  }
});
