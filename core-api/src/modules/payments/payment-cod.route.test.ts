import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function createOrder(baseUrl: string): Promise<{ id: string }> {
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
          quantity: 1,
          unitPriceCents: 1299,
          modifiers: [],
        },
      ],
    }),
  });

  const quoteResponse = await fetch(`${baseUrl}/api/v1/consumer/quotes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ basketId: basket.id }),
  });
  const quote = (await quoteResponse.json()) as {
    quoteId: string;
    quoteHash: string;
    basketId: string;
  };

  const checkoutResponse = await fetch(`${baseUrl}/api/v1/consumer/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      basketId: quote.basketId,
      quoteId: quote.quoteId,
      quoteHash: quote.quoteHash,
    }),
  });
  const checkout = (await checkoutResponse.json()) as {
    checkoutId: string;
    quoteHash: string;
  };

  const orderResponse = await fetch(`${baseUrl}/api/v1/consumer/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      checkoutId: checkout.checkoutId,
      quoteHash: checkout.quoteHash,
    }),
  });

  return (await orderResponse.json()) as { id: string };
}

async function markCashExpected(baseUrl: string, orderId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/internal/payments/cash/expected`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderId,
      expectedAmount: 1912,
      currency: "USD",
    }),
  });

  assert.equal(response.status, 201);
}

test("courier cash collection route reports no mismatch when collected equals expected", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);
    await markCashExpected(baseUrl, order.id);

    const collect = await fetch(`${baseUrl}/api/v1/courier/orders/${order.id}/cash-collection`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        collectedAmount: 1912,
        courierId: "courier-1",
      }),
    });

    assert.equal(collect.status, 200);
    const payload = (await collect.json()) as { mismatch: boolean };
    assert.equal(payload.mismatch, false);
  } finally {
    listener.close();
  }
});

test("courier cash collection route reports mismatch when collected differs from expected", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);
    await markCashExpected(baseUrl, order.id);

    const collect = await fetch(`${baseUrl}/api/v1/courier/orders/${order.id}/cash-collection`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        collectedAmount: 1700,
        courierId: "courier-2",
      }),
    });

    assert.equal(collect.status, 200);
    const payload = (await collect.json()) as { mismatch: boolean };
    assert.equal(payload.mismatch, true);
  } finally {
    listener.close();
  }
});
