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

async function createOrder(baseUrl: string): Promise<{ id: string }> {
  const checkout = await createCheckout(baseUrl);
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

test("support intervention route cancels order", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);

    const response = await fetch(`${baseUrl}/api/v1/support/interventions/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "CANCEL_ORDER",
        actorId: "support-1",
        orderId: order.id,
        reasonCode: "CUSTOMER_REQUEST",
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      status: string;
      result: { status: string };
    };

    assert.equal(payload.status, "COMPLETED");
    assert.equal(payload.result.status, "CANCELLED");
  } finally {
    listener.close();
  }
});

test("support intervention route creates refund request for captured payment", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);

    await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/accept`, {
      method: "POST",
    });

    const authorizeResponse = await fetch(`${baseUrl}/api/v1/payments/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        method: "CARD",
        amount: 1399,
        currency: "USD",
      }),
    });

    const authorized = (await authorizeResponse.json()) as { paymentIntentId: string };

    await fetch(`${baseUrl}/api/v1/payments/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: authorized.paymentIntentId,
        idempotencyKey: "capture-1",
      }),
    });

    const interventionResponse = await fetch(`${baseUrl}/api/v1/support/interventions/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "REFUND_PAYMENT",
        actorId: "support-1",
        orderId: order.id,
        reasonCode: "QUALITY_ISSUE",
        paymentIntentId: authorized.paymentIntentId,
        refundAmount: 500,
      }),
    });

    assert.equal(interventionResponse.status, 200);
    const payload = (await interventionResponse.json()) as {
      status: string;
      result: { status: string };
    };

    assert.equal(payload.status, "COMPLETED");
    assert.equal(payload.result.status, "REQUESTED");
  } finally {
    listener.close();
  }
});

test("support intervention route queues courier reassignment", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/v1/support/interventions/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "REASSIGN_COURIER",
        actorId: "support-1",
        orderId: "order-reassign",
        reasonCode: "COURIER_TIMEOUT",
      }),
    });

    assert.equal(response.status, 202);
    const payload = (await response.json()) as { status: string };
    assert.equal(payload.status, "QUEUED");
  } finally {
    listener.close();
  }
});
