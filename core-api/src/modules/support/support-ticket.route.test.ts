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

test("support ticket timeline route returns correlated order/payment entries", async () => {
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
    const order = (await orderResponse.json()) as { id: string };

    await fetch(`${baseUrl}/api/v1/payments/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        method: "CARD",
        amount: 1399,
        currency: "USD",
      }),
    });

    const ticketResponse = await fetch(`${baseUrl}/api/v1/support/tickets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        actorId: "consumer-1",
        issueType: "PAYMENT_ISSUE",
        summary: "Need payment trace",
      }),
    });

    assert.equal(ticketResponse.status, 201);
    const ticket = (await ticketResponse.json()) as { ticketId: string };

    const timelineResponse = await fetch(
      `${baseUrl}/api/v1/support/tickets/${ticket.ticketId}/timeline`,
    );

    assert.equal(timelineResponse.status, 200);
    const timeline = (await timelineResponse.json()) as {
      entries: Array<{ sourceType: string }>;
    };

    assert.ok(timeline.entries.some((entry) => entry.sourceType === "ORDER_TIMELINE"));
    assert.ok(timeline.entries.some((entry) => entry.sourceType === "PAYMENT_AUDIT"));
  } finally {
    listener.close();
  }
});
