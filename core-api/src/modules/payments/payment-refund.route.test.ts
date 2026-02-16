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

async function capturePayment(baseUrl: string, orderId: string): Promise<{ paymentIntentId: string }> {
  const accept = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/accept`, {
    method: "POST",
  });
  assert.equal(accept.status, 200);

  const authorize = await fetch(`${baseUrl}/api/v1/payments/authorize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderId,
      method: "CARD",
      amount: 1912,
      currency: "USD",
    }),
  });
  assert.equal(authorize.status, 201);
  const authorized = (await authorize.json()) as { paymentIntentId: string };

  const capture = await fetch(`${baseUrl}/api/v1/payments/capture`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      paymentIntentId: authorized.paymentIntentId,
      idempotencyKey: "refund-route-capture-key",
    }),
  });
  assert.equal(capture.status, 200);

  return authorized;
}

test("support refund route creates request and approve route completes it", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);
    const captured = await capturePayment(baseUrl, order.id);

    const requestRefund = await fetch(`${baseUrl}/api/v1/support/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        paymentIntentId: captured.paymentIntentId,
        amount: 500,
        reasonCode: "ITEM_MISSING",
        requestedBy: "support-agent-1",
      }),
    });
    assert.equal(requestRefund.status, 201);
    const refund = (await requestRefund.json()) as { refundRequestId: string; status: string };
    assert.equal(refund.status, "REQUESTED");

    const approve = await fetch(
      `${baseUrl}/internal/payments/refunds/${refund.refundRequestId}/approve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          approvedBy: "finance-ops-1",
        }),
      },
    );
    assert.equal(approve.status, 200);
    const completed = (await approve.json()) as { status: string };
    assert.equal(completed.status, "COMPLETED");
  } finally {
    listener.close();
  }
});
