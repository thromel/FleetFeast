import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function createCheckout(baseUrl: string) {
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

  return (await checkoutResponse.json()) as {
    checkoutId: string;
    quoteHash: string;
  };
}

test("POST /api/v1/consumer/orders creates order from checkout", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const checkout = await createCheckout(baseUrl);

    const orderResponse = await fetch(`${baseUrl}/api/v1/consumer/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        checkoutId: checkout.checkoutId,
        quoteHash: checkout.quoteHash,
      }),
    });

    assert.equal(orderResponse.status, 201);
    const order = (await orderResponse.json()) as { status: string };
    assert.equal(order.status, "CREATED");
  } finally {
    listener.close();
  }
});

test("GET /api/v1/consumer/orders/{orderId} returns persisted order details", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const checkout = await createCheckout(baseUrl);

    const orderResponse = await fetch(`${baseUrl}/api/v1/consumer/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        checkoutId: checkout.checkoutId,
        quoteHash: checkout.quoteHash,
      }),
    });
    assert.equal(orderResponse.status, 201);
    const createdOrder = (await orderResponse.json()) as { id: string };

    const getOrderResponse = await fetch(`${baseUrl}/api/v1/consumer/orders/${createdOrder.id}`);
    assert.equal(getOrderResponse.status, 200);
    const payload = (await getOrderResponse.json()) as {
      id: string;
      status: string;
      checkoutId: string;
    };

    assert.equal(payload.id, createdOrder.id);
    assert.equal(payload.status, "CREATED");
    assert.equal(payload.checkoutId, checkout.checkoutId);
  } finally {
    listener.close();
  }
});

test("GET /api/v1/consumer/orders/{orderId} returns 404 for unknown order", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/v1/consumer/orders/non-existent`);
    assert.equal(response.status, 404);

    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "ORDER_NOT_FOUND");
  } finally {
    listener.close();
  }
});
