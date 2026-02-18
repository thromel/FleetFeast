import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

const payload = {
  runAt: "2026-02-18T09:00:00Z",
  candidates: [
    {
      entityType: "MERCHANT",
      entityId: "merchant-persist-1",
      amount: 1900,
      hasException: false,
    },
    {
      entityType: "COURIER",
      entityId: "courier-persist-1",
      amount: 420,
      hasException: true,
      holdReason: "MANUAL_REVIEW_PENDING",
    },
  ],
};

test("scheduled payout run remains idempotent after core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let firstBatchId: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
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
    firstBatchId = firstBatch.payoutBatchId;
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
    assert.equal(secondBatch.payoutBatchId, firstBatchId);
  } finally {
    listenerB.close();
  }
});
