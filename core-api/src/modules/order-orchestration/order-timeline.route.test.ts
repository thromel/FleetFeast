import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function createAndAdvanceOrder(baseUrl: string): Promise<{ id: string }> {
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
  const order = (await createOrderResponse.json()) as { id: string };

  const accept = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/accept`, {
    method: "POST",
  });
  assert.equal(accept.status, 200);

  const dispatch = await fetch(`${baseUrl}/internal/orders/${order.id}/request-dispatch`, {
    method: "POST",
  });
  assert.equal(dispatch.status, 200);

  return order;
}

test("consumer timeline endpoint returns projected immutable timeline", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createAndAdvanceOrder(baseUrl);

    const timelineResponse = await fetch(
      `${baseUrl}/api/v1/consumer/orders/${order.id}/timeline`,
      { method: "GET" },
    );

    assert.equal(timelineResponse.status, 200);
    const payload = (await timelineResponse.json()) as {
      orderId: string;
      entries: Array<{ eventType: string }>;
    };
    assert.equal(payload.orderId, order.id);
    assert.deepEqual(
      payload.entries.map((entry) => entry.eventType),
      ["order.created.v1", "order.confirmed.v1", "dispatch.assignment.requested.v1"],
    );
  } finally {
    listener.close();
  }
});

test("internal rebuild endpoint replays event log and keeps timeline available", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createAndAdvanceOrder(baseUrl);

    const rebuildResponse = await fetch(`${baseUrl}/internal/orders/timeline/rebuild`, {
      method: "POST",
    });
    assert.equal(rebuildResponse.status, 200);
    const rebuild = (await rebuildResponse.json()) as { entriesRebuilt: number };
    assert.ok(rebuild.entriesRebuilt >= 3);

    const timelineResponse = await fetch(
      `${baseUrl}/api/v1/consumer/orders/${order.id}/timeline`,
      { method: "GET" },
    );
    assert.equal(timelineResponse.status, 200);
    const payload = (await timelineResponse.json()) as { entries: unknown[] };
    assert.ok(payload.entries.length >= 3);
  } finally {
    listener.close();
  }
});
