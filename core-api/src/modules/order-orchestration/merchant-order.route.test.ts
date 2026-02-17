import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function createOrder(baseUrl: string) {
  const createBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consumerId: "consumer-merchant-portal",
      merchantId: "merchant-portal-1",
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
          itemId: "item-merchant-portal",
          name: "Noodles",
          quantity: 1,
          unitPriceCents: 1499,
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

  assert.equal(orderResponse.status, 201);
  return (await orderResponse.json()) as {
    id: string;
    status: string;
    cancellationReason: string | null;
    cancelledBy: string | null;
  };
}

test("merchant reject endpoint cancels created order with reason code", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);

    const rejectResponse = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reasonCode: "OUT_OF_STOCK" }),
    });

    assert.equal(rejectResponse.status, 200);
    const payload = (await rejectResponse.json()) as {
      status: string;
      cancellationReason: string | null;
      cancelledBy: string | null;
    };

    assert.equal(payload.status, "CANCELLED");
    assert.equal(payload.cancellationReason, "OUT_OF_STOCK");
    assert.equal(payload.cancelledBy, "merchant_operator");
  } finally {
    listener.close();
  }
});

test("merchant orders endpoint lists created and rejected orders", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const createdOrder = await createOrder(baseUrl);
    const rejectedOrder = await createOrder(baseUrl);

    const rejectResponse = await fetch(
      `${baseUrl}/api/v1/merchant/orders/${rejectedOrder.id}/reject`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reasonCode: "MERCHANT_REJECTED" }),
      },
    );
    assert.equal(rejectResponse.status, 200);

    const listResponse = await fetch(`${baseUrl}/api/v1/merchant/orders`);
    assert.equal(listResponse.status, 200);

    const payload = (await listResponse.json()) as {
      orders: Array<{
        id: string;
        status: string;
      }>;
    };

    const created = payload.orders.find((orderRecord) => orderRecord.id === createdOrder.id);
    const rejected = payload.orders.find((orderRecord) => orderRecord.id === rejectedOrder.id);

    assert.ok(created);
    assert.equal(created?.status, "CREATED");

    assert.ok(rejected);
    assert.equal(rejected?.status, "CANCELLED");
  } finally {
    listener.close();
  }
});

test("merchant reject endpoint rejects missing reason code", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);

    const rejectResponse = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(rejectResponse.status, 400);
    const payload = (await rejectResponse.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
