import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("POST and PUT menu routes maintain version history", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const createResponse = await fetch(`${baseUrl}/api/v1/merchant/catalog/menus`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchantId: "merchant-1",
        storeId: "store-1",
        name: "Lunch Menu",
        items: [{ itemId: "item-1", name: "Burger", priceCents: 1299 }],
      }),
    });

    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as { id: string; currentVersion: number };
    assert.equal(created.currentVersion, 1);

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/merchant/catalog/menus/${created.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Lunch Menu v2",
          items: [{ itemId: "item-1", name: "Burger", priceCents: 1399 }],
        }),
      },
    );

    assert.equal(updateResponse.status, 200);
    const updated = (await updateResponse.json()) as { currentVersion: number };
    assert.equal(updated.currentVersion, 2);

    const versionsResponse = await fetch(
      `${baseUrl}/api/v1/merchant/catalog/menus/${created.id}/versions`,
    );

    assert.equal(versionsResponse.status, 200);
    const versionsPayload = (await versionsResponse.json()) as {
      versions: Array<{ version: number }>;
    };

    assert.equal(versionsPayload.versions.length, 2);
    assert.deepEqual(
      versionsPayload.versions.map((version) => version.version),
      [1, 2],
    );
  } finally {
    listener.close();
  }
});
