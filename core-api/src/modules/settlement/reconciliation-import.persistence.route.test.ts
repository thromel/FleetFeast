import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

const payload = {
  runAt: "2026-02-18T10:00:00Z",
  sourceFileName: "processor-settlement-2026-02-18.csv",
  expectedRecords: [
    { entityId: "merchant-persist-1", amount: 5000 },
    { entityId: "courier-persist-1", amount: 1200 },
  ],
  actualRecordsCsv: "entityId,amount\nmerchant-persist-1,4975\ncourier-persist-1,1200\n",
  toleranceCents: 20,
};

test("scheduled reconciliation import remains idempotent after core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let firstImportRunId: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const firstRun = await fetch(
      `${baseUrl}/internal/settlement/reconciliation/import-schedules/daily-1000/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    assert.equal(firstRun.status, 201);
    const firstImportRun = (await firstRun.json()) as { importRunId: string };
    firstImportRunId = firstImportRun.importRunId;
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
      `${baseUrl}/internal/settlement/reconciliation/import-schedules/daily-1000/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    assert.equal(secondRun.status, 200);
    const secondImportRun = (await secondRun.json()) as { importRunId: string };
    assert.equal(secondImportRun.importRunId, firstImportRunId);
  } finally {
    listenerB.close();
  }
});
