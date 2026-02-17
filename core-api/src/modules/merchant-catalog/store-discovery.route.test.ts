import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("consumer stores endpoint lists orderability for discoverable stores", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const menuOne = await fetch(`${baseUrl}/api/v1/merchant/catalog/menus`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchantId: "merchant-a",
        storeId: "store-a",
        name: "Store A Menu",
        items: [
          {
            itemId: "a-1",
            name: "Burger",
            priceCents: 1299,
          },
        ],
      }),
    });
    assert.equal(menuOne.status, 201);

    const menuTwo = await fetch(`${baseUrl}/api/v1/merchant/catalog/menus`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchantId: "merchant-b",
        storeId: "store-b",
        name: "Store B Menu",
        items: [
          {
            itemId: "b-1",
            name: "Pizza",
            priceCents: 1599,
          },
        ],
      }),
    });
    assert.equal(menuTwo.status, 201);

    const storeAStatus = await fetch(`${baseUrl}/api/v1/merchant/stores/store-a/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paused: false,
        schedule: {
          open: "00:00",
          close: "23:59",
          timezone: "UTC",
        },
      }),
    });
    assert.equal(storeAStatus.status, 200);

    const storeBStatus = await fetch(`${baseUrl}/api/v1/merchant/stores/store-b/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paused: true,
        schedule: {
          open: "00:00",
          close: "23:59",
          timezone: "UTC",
        },
      }),
    });
    assert.equal(storeBStatus.status, 200);

    const listResponse = await fetch(`${baseUrl}/api/v1/consumer/stores`);
    assert.equal(listResponse.status, 200);

    const payload = (await listResponse.json()) as {
      stores: Array<{ storeId: string; orderable: boolean; reason: string }>;
    };

    const storeA = payload.stores.find((store) => store.storeId === "store-a");
    const storeB = payload.stores.find((store) => store.storeId === "store-b");

    assert.ok(storeA);
    assert.equal(storeA?.orderable, true);
    assert.equal(storeA?.reason, "OK");

    assert.ok(storeB);
    assert.equal(storeB?.orderable, false);
    assert.equal(storeB?.reason, "STORE_PAUSED");
  } finally {
    listener.close();
  }
});

test("consumer stores endpoint filters by orderable query", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    await fetch(`${baseUrl}/api/v1/merchant/catalog/menus`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchantId: "merchant-a",
        storeId: "store-a",
        name: "Store A Menu",
        items: [{ itemId: "a-1", name: "Burger", priceCents: 1299 }],
      }),
    });

    await fetch(`${baseUrl}/api/v1/merchant/catalog/menus`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchantId: "merchant-b",
        storeId: "store-b",
        name: "Store B Menu",
        items: [{ itemId: "b-1", name: "Pizza", priceCents: 1599 }],
      }),
    });

    await fetch(`${baseUrl}/api/v1/merchant/stores/store-a/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paused: false,
        schedule: { open: "00:00", close: "23:59", timezone: "UTC" },
      }),
    });

    await fetch(`${baseUrl}/api/v1/merchant/stores/store-b/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paused: true,
        schedule: { open: "00:00", close: "23:59", timezone: "UTC" },
      }),
    });

    const response = await fetch(`${baseUrl}/api/v1/consumer/stores?orderable=true`);
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      stores: Array<{ storeId: string; orderable: boolean }>;
    };

    assert.equal(payload.stores.length, 1);
    assert.equal(payload.stores[0]?.storeId, "store-a");
    assert.equal(payload.stores[0]?.orderable, true);
  } finally {
    listener.close();
  }
});

test("consumer stores endpoint validates orderable query", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/v1/consumer/stores?orderable=maybe`);

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
