import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("scheduled settlement reconciliation import endpoint is idempotent by scheduleId and runAt", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const payload = {
      runAt: "2026-02-18T10:00:00Z",
      sourceFileName: "processor-settlement-2026-02-18.csv",
      expectedRecords: [
        { entityId: "merchant-1", amount: 5000 },
        { entityId: "courier-1", amount: 1200 },
      ],
      actualRecordsCsv: "entityId,amount\nmerchant-1,4975\ncourier-1,1200\n",
      toleranceCents: 20,
    };

    const firstRun = await fetch(
      `${baseUrl}/internal/settlement/reconciliation/import-schedules/daily-1000/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    assert.equal(firstRun.status, 201);
    const firstImportRun = (await firstRun.json()) as {
      importRunId: string;
      ingestedRecords: number;
      result: { reconciliationId: string };
    };
    assert.equal(firstImportRun.ingestedRecords, 2);

    const secondRun = await fetch(
      `${baseUrl}/internal/settlement/reconciliation/import-schedules/daily-1000/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    assert.equal(secondRun.status, 200);
    const secondImportRun = (await secondRun.json()) as {
      importRunId: string;
      result: { reconciliationId: string };
    };

    assert.equal(secondImportRun.importRunId, firstImportRun.importRunId);
    assert.equal(
      secondImportRun.result.reconciliationId,
      firstImportRun.result.reconciliationId,
    );
  } finally {
    listener.close();
  }
});

test("scheduled settlement reconciliation import endpoint validates payload", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(
      `${baseUrl}/internal/settlement/reconciliation/import-schedules/daily-1000/run`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runAt: "invalid-date",
          sourceFileName: "",
          expectedRecords: [],
          actualRecordsCsv: "bad",
          toleranceCents: -1,
        }),
      },
    );

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
