import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("SLO dashboard route returns computed metrics", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await fetch(`${baseUrl}/health`);

    const response = await fetch(`${baseUrl}/internal/observability/slo/dashboard`);
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      availabilityPercent: number;
      checkoutP95Ms: number;
      timelineP95Ms: number;
      breaches: unknown[];
    };

    assert.ok(typeof payload.availabilityPercent === "number");
    assert.ok(typeof payload.checkoutP95Ms === "number");
    assert.ok(typeof payload.timelineP95Ms === "number");
    assert.ok(Array.isArray(payload.breaches));
  } finally {
    listener.close();
  }
});
