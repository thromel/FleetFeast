import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function createCheckout(
  baseUrl: string,
  options?: {
    consumerId?: string;
    merchantId?: string;
  },
) {
  const consumerId = options?.consumerId ?? "consumer-1";
  const merchantId = options?.merchantId ?? "merchant-1";
  const createBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consumerId,
      merchantId,
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

async function createOrder(
  baseUrl: string,
  options?: {
    consumerId?: string;
    merchantId?: string;
  },
) {
  const checkout = await createCheckout(baseUrl, options);
  const orderResponse = await fetch(`${baseUrl}/api/v1/consumer/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      checkoutId: checkout.checkoutId,
      quoteHash: checkout.quoteHash,
    }),
  });
  assert.equal(orderResponse.status, 201);
  return (await orderResponse.json()) as { id: string; status: string };
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
    const order = await createOrder(baseUrl);
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

test("GET /api/v1/consumer/orders lists orders by consumer and status", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const createdOrder = await createOrder(baseUrl, {
      consumerId: "consumer-list-1",
      merchantId: "merchant-list-1",
    });
    const cancelledOrder = await createOrder(baseUrl, {
      consumerId: "consumer-list-1",
      merchantId: "merchant-list-1",
    });
    await createOrder(baseUrl, {
      consumerId: "consumer-list-2",
      merchantId: "merchant-list-1",
    });

    const cancellationResponse = await fetch(
      `${baseUrl}/api/v1/consumer/orders/${cancelledOrder.id}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reasonCode: "CHANGED_MIND" }),
      },
    );
    assert.equal(cancellationResponse.status, 200);

    const listResponse = await fetch(
      `${baseUrl}/api/v1/consumer/orders?consumerId=consumer-list-1`,
    );
    assert.equal(listResponse.status, 200);
    const listPayload = (await listResponse.json()) as {
      orders: Array<{ id: string; status: string }>;
    };

    const createdRecord = listPayload.orders.find((order) => order.id === createdOrder.id);
    const cancelledRecord = listPayload.orders.find((order) => order.id === cancelledOrder.id);
    assert.ok(createdRecord);
    assert.equal(createdRecord?.status, "CREATED");
    assert.ok(cancelledRecord);
    assert.equal(cancelledRecord?.status, "CANCELLED");

    const cancelledOnlyResponse = await fetch(
      `${baseUrl}/api/v1/consumer/orders?consumerId=consumer-list-1&status=CANCELLED`,
    );
    assert.equal(cancelledOnlyResponse.status, 200);
    const cancelledOnlyPayload = (await cancelledOnlyResponse.json()) as {
      orders: Array<{ id: string; status: string }>;
    };

    assert.equal(cancelledOnlyPayload.orders.length, 1);
    assert.equal(cancelledOnlyPayload.orders[0]?.id, cancelledOrder.id);
    assert.equal(cancelledOnlyPayload.orders[0]?.status, "CANCELLED");
  } finally {
    listener.close();
  }
});

test("GET /api/v1/consumer/orders rejects missing consumerId query", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/v1/consumer/orders`);
    assert.equal(response.status, 400);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
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
