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

test("consumer cancel endpoint cancels CREATED order", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);

    const cancelResponse = await fetch(`${baseUrl}/api/v1/consumer/orders/${order.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reasonCode: "CONSUMER_CHANGED_MIND" }),
    });

    assert.equal(cancelResponse.status, 200);
    const payload = (await cancelResponse.json()) as {
      status: string;
      cancellationReason: string;
      cancelledBy: string;
    };
    assert.equal(payload.status, "CANCELLED");
    assert.equal(payload.cancellationReason, "CONSUMER_CHANGED_MIND");
    assert.equal(payload.cancelledBy, "consumer");
  } finally {
    listener.close();
  }
});

test("consumer cancel endpoint rejects cancellation when order is DISPATCH_PENDING", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);

    const accept = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/accept`, {
      method: "POST",
    });
    assert.equal(accept.status, 200);

    const dispatchRequest = await fetch(`${baseUrl}/internal/orders/${order.id}/request-dispatch`, {
      method: "POST",
    });
    assert.equal(dispatchRequest.status, 200);

    const cancelResponse = await fetch(`${baseUrl}/api/v1/consumer/orders/${order.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reasonCode: "TOO_EXPENSIVE" }),
    });

    assert.equal(cancelResponse.status, 409);
    const payload = (await cancelResponse.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "ORDER_CANCELLATION_NOT_ALLOWED");
  } finally {
    listener.close();
  }
});
