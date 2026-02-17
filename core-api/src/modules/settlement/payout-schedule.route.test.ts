import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal payout schedule run endpoint is idempotent by scheduleId and runAt", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const payload = {
      runAt: "2026-02-16T09:00:00Z",
      candidates: [
        {
          entityType: "MERCHANT",
          entityId: "merchant-1",
          amount: 1200,
          hasException: false,
        },
      ],
    };

    const firstRun = await fetch(
      `${baseUrl}/internal/settlement/payout-schedules/daily-0900/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    assert.equal(firstRun.status, 201);
    const firstBatch = (await firstRun.json()) as { payoutBatchId: string };

    const secondRun = await fetch(
      `${baseUrl}/internal/settlement/payout-schedules/daily-0900/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    assert.equal(secondRun.status, 200);
    const secondBatch = (await secondRun.json()) as { payoutBatchId: string };

    assert.equal(secondBatch.payoutBatchId, firstBatch.payoutBatchId);
  } finally {
    listener.close();
  }
});

test("internal payout schedule run endpoint validates payload", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(
      `${baseUrl}/internal/settlement/payout-schedules/daily-0900/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidates: [] }),
      },
    );

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
