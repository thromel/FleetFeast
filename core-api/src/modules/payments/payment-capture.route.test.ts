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

  const createOrderResponse = await fetch(`${baseUrl}/api/v1/consumer/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      checkoutId: checkout.checkoutId,
      quoteHash: checkout.quoteHash,
    }),
  });

  return (await createOrderResponse.json()) as { id: string };
}

async function authorize(baseUrl: string, orderId: string): Promise<{ paymentIntentId: string }> {
  const response = await fetch(`${baseUrl}/api/v1/payments/authorize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderId,
      method: "CARD",
      amount: 1912,
      currency: "USD",
    }),
  });

  return (await response.json()) as { paymentIntentId: string };
}

test("POST /api/v1/payments/capture captures authorized payment when preconditions pass", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);
    const authorized = await authorize(baseUrl, order.id);

    const accept = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/accept`, {
      method: "POST",
    });
    assert.equal(accept.status, 200);

    const capture = await fetch(`${baseUrl}/api/v1/payments/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: authorized.paymentIntentId,
        idempotencyKey: "capture-route-1",
      }),
    });

    assert.equal(capture.status, 200);
    const payload = (await capture.json()) as { status: string };
    assert.equal(payload.status, "CAPTURED");
  } finally {
    listener.close();
  }
});

test("POST /api/v1/payments/capture returns 409 when capture preconditions fail", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);
    const authorized = await authorize(baseUrl, order.id);

    const capture = await fetch(`${baseUrl}/api/v1/payments/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: authorized.paymentIntentId,
        idempotencyKey: "capture-route-2",
      }),
    });

    assert.equal(capture.status, 409);
    const payload = (await capture.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "PAYMENT_CAPTURE_PRECONDITION_FAILED");
  } finally {
    listener.close();
  }
});
