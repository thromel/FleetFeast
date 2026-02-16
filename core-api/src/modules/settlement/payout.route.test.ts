import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("POST /api/v1/admin/payouts/generate creates payout batch with hold records", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/v1/admin/payouts/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scheduleId: "daily-0900",
        runAt: "2026-02-16T09:00:00Z",
        candidates: [
          {
            entityType: "MERCHANT",
            entityId: "merchant-1",
            amount: 1200,
            hasException: false,
          },
          {
            entityType: "COURIER",
            entityId: "courier-1",
            amount: 800,
            hasException: true,
            holdReason: "LEDGER_MISMATCH",
          },
        ],
      }),
    });

    assert.equal(response.status, 201);
    const payload = (await response.json()) as {
      payouts: unknown[];
      holds: unknown[];
    };
    assert.equal(payload.payouts.length, 1);
    assert.equal(payload.holds.length, 1);
  } finally {
    listener.close();
  }
});
