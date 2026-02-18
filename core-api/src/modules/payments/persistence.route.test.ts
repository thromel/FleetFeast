import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

async function createOrder(baseUrl: string): Promise<{ id: string }> {
  const createBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consumerId: "consumer-payments-persistence-1",
      merchantId: "merchant-payments-persistence-1",
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
          itemId: "item-payments-persistence-1",
          name: "Persisted Burrito",
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

  return (await orderResponse.json()) as { id: string };
}

async function acceptOrder(baseUrl: string, orderId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/merchant/orders/${orderId}/accept`, {
    method: "POST",
  });
  assert.equal(response.status, 200);
}

async function authorizeCardPayment(baseUrl: string, orderId: string): Promise<{ paymentIntentId: string }> {
  const response = await fetch(`${baseUrl}/api/v1/payments/authorize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderId,
      method: "CARD",
      amount: 2212,
      currency: "USD",
    }),
  });
  assert.equal(response.status, 201);

  return (await response.json()) as { paymentIntentId: string };
}

async function capturePayment(
  baseUrl: string,
  paymentIntentId: string,
  idempotencyKey: string,
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/payments/capture`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ paymentIntentId, idempotencyKey }),
  });
}

test("authorized payment intent survives core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let orderId: string;
  let paymentIntentId: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);
    await acceptOrder(baseUrl, order.id);
    const authorized = await authorizeCardPayment(baseUrl, order.id);

    orderId = order.id;
    paymentIntentId = authorized.paymentIntentId;
  } finally {
    listenerA.close();
  }

  const appB = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerB = appB.listen(0);

  try {
    const address = listenerB.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const capture = await capturePayment(
      baseUrl,
      paymentIntentId!,
      "payments-persistence-restart-capture-1",
    );
    assert.equal(capture.status, 200);

    const capturedPayload = (await capture.json()) as { status: string; orderId: string };
    assert.equal(capturedPayload.status, "CAPTURED");
    assert.equal(capturedPayload.orderId, orderId);
  } finally {
    listenerB.close();
  }
});

test("refund request survives core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let orderId: string;
  let refundRequestId: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);
    await acceptOrder(baseUrl, order.id);

    const authorized = await authorizeCardPayment(baseUrl, order.id);
    const capture = await capturePayment(
      baseUrl,
      authorized.paymentIntentId,
      "payments-persistence-restart-capture-2",
    );
    assert.equal(capture.status, 200);

    const requestRefund = await fetch(`${baseUrl}/api/v1/support/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        paymentIntentId: authorized.paymentIntentId,
        amount: 500,
        reasonCode: "MISSING_ITEM",
        requestedBy: "support-agent-1",
      }),
    });
    assert.equal(requestRefund.status, 201);

    const refundPayload = (await requestRefund.json()) as { refundRequestId: string };
    orderId = order.id;
    refundRequestId = refundPayload.refundRequestId;
  } finally {
    listenerA.close();
  }

  const appB = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerB = appB.listen(0);

  try {
    const address = listenerB.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const approve = await fetch(
      `${baseUrl}/internal/payments/refunds/${refundRequestId!}/approve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvedBy: "finance-ops-1" }),
      },
    );
    assert.equal(approve.status, 200);
    const approvePayload = (await approve.json()) as { status: string };
    assert.equal(approvePayload.status, "COMPLETED");

    const audit = await fetch(`${baseUrl}/internal/payments/audit/${orderId!}`);
    assert.equal(audit.status, 200);
    const auditPayload = (await audit.json()) as { records: Array<{ actionType: string }> };
    assert.ok(auditPayload.records.some((record) => record.actionType === "REFUND_REQUESTED"));
    assert.ok(auditPayload.records.some((record) => record.actionType === "REFUND_COMPLETED"));
  } finally {
    listenerB.close();
  }
});
