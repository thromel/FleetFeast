import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal settlement reconciliation route returns exception cases", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/settlement/reconciliation/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRecords: [
          { entityId: "merchant-1", amount: 5000 },
          { entityId: "courier-1", amount: 1200 },
        ],
        actualRecords: [
          { entityId: "merchant-1", amount: 4800 },
          { entityId: "courier-1", amount: 1200 },
        ],
        toleranceCents: 50,
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      exceptionCases: Array<{ entityId: string; reason: string; variance: number }>;
      totalExpectedAmount: number;
      totalActualAmount: number;
    };

    assert.equal(payload.totalExpectedAmount, 6200);
    assert.equal(payload.totalActualAmount, 6000);
    assert.equal(payload.exceptionCases.length, 1);
    assert.equal(payload.exceptionCases[0]?.entityId, "merchant-1");
    assert.equal(payload.exceptionCases[0]?.reason, "AMOUNT_MISMATCH");
    assert.equal(payload.exceptionCases[0]?.variance, -200);
  } finally {
    listener.close();
  }
});

test("internal settlement reconciliation route validates payload", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/settlement/reconciliation/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRecords: [{ entityId: "merchant-1", amount: "oops" }],
        actualRecords: [],
        toleranceCents: 50,
      }),
    });

    assert.equal(response.status, 400);
  } finally {
    listener.close();
  }
});
