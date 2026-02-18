import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

test("published payout statement survives core-api restart when persistence is enabled", async () => {
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
    const publishResponse = await fetch(`${baseUrl}/internal/settlement/payout-statements/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        payoutBatchId: "batch-persist-merchant-1",
        entityType: "MERCHANT",
        entityId: "merchant-persist-1",
        periodStart: "2026-02-01T00:00:00Z",
        periodEnd: "2026-02-07T23:59:59Z",
        currency: "USD",
        totalAmount: 1200,
        lineItems: [
          {
            label: "Net Earnings",
            amount: 1200,
          },
        ],
      }),
    });

    assert.equal(publishResponse.status, 201);
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
    const listResponse = await fetch(`${baseUrl}/api/v1/merchant/payouts?merchantId=merchant-persist-1`);
    assert.equal(listResponse.status, 200);

    const payload = (await listResponse.json()) as {
      statements: Array<{ entityId: string; payoutBatchId: string }>;
    };

    assert.equal(payload.statements.length, 1);
    assert.equal(payload.statements[0]?.entityId, "merchant-persist-1");
    assert.equal(payload.statements[0]?.payoutBatchId, "batch-persist-merchant-1");
  } finally {
    listenerB.close();
  }
});
