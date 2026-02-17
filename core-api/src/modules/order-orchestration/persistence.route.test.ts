import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

async function createOrder(baseUrl: string): Promise<{ id: string; checkoutId: string }> {
  const createBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consumerId: "consumer-persistence-1",
      merchantId: "merchant-persistence-1",
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
          itemId: "item-persistence-1",
          name: "Persisted Bowl",
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
  assert.equal(orderResponse.status, 201);
  const order = (await orderResponse.json()) as { id: string };
  return {
    id: order.id,
    checkoutId: checkout.checkoutId,
  };
}

test("order details survive core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let orderId: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createOrder(baseUrl);
    orderId = order.id;
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
    const response = await fetch(`${baseUrl}/api/v1/consumer/orders/${orderId!}`);
    assert.equal(response.status, 200);

    const payload = (await response.json()) as { id: string };
    assert.equal(payload.id, orderId);
  } finally {
    listenerB.close();
  }
});

test("refresh token survives core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let refreshToken: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "persist-refresh@example.com",
        phone: "+15555550999",
        passwordHash: "pw-hash",
        role: "consumer",
      }),
    });
    assert.equal(registerResponse.status, 201);

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "persist-refresh@example.com",
        passwordHash: "pw-hash",
      }),
    });
    assert.equal(loginResponse.status, 200);
    const loginPayload = (await loginResponse.json()) as { refreshToken: string };
    refreshToken = loginPayload.refreshToken;
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
    const refreshResponse = await fetch(`${baseUrl}/api/v1/identity/token/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshToken! }),
    });
    assert.equal(refreshResponse.status, 200);
  } finally {
    listenerB.close();
  }
});
