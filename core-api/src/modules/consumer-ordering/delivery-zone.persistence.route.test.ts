import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

test("delivery zone configuration survives core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const upsert = await fetch(`${baseUrl}/api/v1/admin/delivery-zones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        zoneId: "zone-persist-1",
        name: "Persist Zone",
        minLat: 40.7000,
        maxLat: 40.8000,
        minLng: -74.0500,
        maxLng: -73.9000,
      }),
    });

    assert.equal(upsert.status, 201);
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
    const validate = await fetch(`${baseUrl}/api/v1/consumer/quotes/validate-zone`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ latitude: 40.7500, longitude: -73.9800 }),
    });

    assert.equal(validate.status, 200);
    const payload = (await validate.json()) as { serviceable: boolean; zoneId: string };
    assert.equal(payload.serviceable, true);
    assert.equal(payload.zoneId, "zone-persist-1");
  } finally {
    listenerB.close();
  }
});
