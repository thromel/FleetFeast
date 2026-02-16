import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("zone routes upsert and validate serviceability", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const upsert = await fetch(`${baseUrl}/api/v1/admin/delivery-zones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        zoneId: "zone-a",
        name: "Downtown",
        minLat: 40.7000,
        maxLat: 40.8000,
        minLng: -74.0500,
        maxLng: -73.9000,
      }),
    });

    assert.equal(upsert.status, 201);

    const inside = await fetch(`${baseUrl}/api/v1/consumer/quotes/validate-zone`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ latitude: 40.7500, longitude: -73.9800 }),
    });

    assert.equal(inside.status, 200);
    const insidePayload = (await inside.json()) as { serviceable: boolean; zoneId: string };
    assert.equal(insidePayload.serviceable, true);
    assert.equal(insidePayload.zoneId, "zone-a");

    const outside = await fetch(`${baseUrl}/api/v1/consumer/quotes/validate-zone`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ latitude: 40.6000, longitude: -73.8000 }),
    });

    assert.equal(outside.status, 200);
    const outsidePayload = (await outside.json()) as {
      serviceable: boolean;
      reason: string;
    };
    assert.equal(outsidePayload.serviceable, false);
    assert.equal(outsidePayload.reason, "OUT_OF_ZONE");
  } finally {
    listener.close();
  }
});
