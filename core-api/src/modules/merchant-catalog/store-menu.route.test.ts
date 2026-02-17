import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function createMenu(baseUrl: string, storeId = "store-consumer-menu-1") {
  const createResponse = await fetch(`${baseUrl}/api/v1/merchant/catalog/menus`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      merchantId: "merchant-consumer-menu-1",
      storeId,
      name: "Dinner Menu",
      items: [
        { itemId: "item-consumer-menu-1", name: "Sushi", priceCents: 1899 },
        { itemId: "item-consumer-menu-2", name: "Miso Soup", priceCents: 499 },
      ],
    }),
  });

  assert.equal(createResponse.status, 201);
}

test("consumer store menu endpoint returns current menu with availability metadata", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await createMenu(baseUrl);

    const availabilityResponse = await fetch(
      `${baseUrl}/api/v1/merchant/items/item-consumer-menu-1/availability`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ available: false, reason: "SOLD_OUT" }),
      },
    );
    assert.equal(availabilityResponse.status, 200);

    const response = await fetch(`${baseUrl}/api/v1/consumer/stores/store-consumer-menu-1/menu`);
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      storeId: string;
      items: Array<{
        itemId: string;
        name: string;
        available: boolean;
        unavailableReason: string | null;
      }>;
    };

    assert.equal(payload.storeId, "store-consumer-menu-1");
    const sushi = payload.items.find((item) => item.itemId === "item-consumer-menu-1");
    const soup = payload.items.find((item) => item.itemId === "item-consumer-menu-2");
    assert.ok(sushi);
    assert.equal(sushi?.available, false);
    assert.equal(sushi?.unavailableReason, "SOLD_OUT");
    assert.ok(soup);
    assert.equal(soup?.available, true);
    assert.equal(soup?.unavailableReason, null);
  } finally {
    listener.close();
  }
});

test("consumer store menu endpoint supports availableOnly filter", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await createMenu(baseUrl);

    await fetch(`${baseUrl}/api/v1/merchant/items/item-consumer-menu-1/availability`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ available: false, reason: "SOLD_OUT" }),
    });

    const response = await fetch(
      `${baseUrl}/api/v1/consumer/stores/store-consumer-menu-1/menu?availableOnly=true`,
    );
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      items: Array<{ itemId: string; available: boolean }>;
    };

    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0]?.itemId, "item-consumer-menu-2");
    assert.equal(payload.items[0]?.available, true);
  } finally {
    listener.close();
  }
});

test("consumer store menu endpoint returns 404 when store menu is missing", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/v1/consumer/stores/missing-store/menu`);
    assert.equal(response.status, 404);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "CATALOG_STORE_MENU_NOT_FOUND");
  } finally {
    listener.close();
  }
});

test("consumer store menu endpoint validates availableOnly query", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await createMenu(baseUrl);

    const response = await fetch(
      `${baseUrl}/api/v1/consumer/stores/store-consumer-menu-1/menu?availableOnly=yes`,
    );
    assert.equal(response.status, 400);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
