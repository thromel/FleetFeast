import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("merchant payout statements route returns published merchant statements", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const publishResponse = await fetch(`${baseUrl}/internal/settlement/payout-statements/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        payoutBatchId: "batch-merchant-1",
        entityType: "MERCHANT",
        entityId: "merchant-1",
        periodStart: "2026-02-01T00:00:00Z",
        periodEnd: "2026-02-07T23:59:59Z",
        currency: "USD",
        totalAmount: 950,
        lineItems: [
          {
            label: "Net Earnings",
            amount: 950,
          },
        ],
      }),
    });

    assert.equal(publishResponse.status, 201);

    const listResponse = await fetch(`${baseUrl}/api/v1/merchant/payouts?merchantId=merchant-1`);
    assert.equal(listResponse.status, 200);

    const payload = (await listResponse.json()) as {
      statements: Array<{ entityId: string; entityType: string }>;
    };

    assert.equal(payload.statements.length, 1);
    assert.equal(payload.statements[0]?.entityType, "MERCHANT");
    assert.equal(payload.statements[0]?.entityId, "merchant-1");
  } finally {
    listener.close();
  }
});

test("courier payout statements route filters statements by courier id", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    for (const courierId of ["courier-1", "courier-2"]) {
      const publishResponse = await fetch(`${baseUrl}/internal/settlement/payout-statements/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payoutBatchId: `batch-${courierId}`,
          entityType: "COURIER",
          entityId: courierId,
          periodStart: "2026-02-01T00:00:00Z",
          periodEnd: "2026-02-07T23:59:59Z",
          currency: "USD",
          totalAmount: 500,
          lineItems: [
            {
              label: "Delivery Earnings",
              amount: 500,
            },
          ],
        }),
      });

      assert.equal(publishResponse.status, 201);
    }

    const listResponse = await fetch(`${baseUrl}/api/v1/courier/payouts?courierId=courier-1`);
    assert.equal(listResponse.status, 200);

    const payload = (await listResponse.json()) as {
      statements: Array<{ entityId: string; entityType: string }>;
    };

    assert.equal(payload.statements.length, 1);
    assert.equal(payload.statements[0]?.entityType, "COURIER");
    assert.equal(payload.statements[0]?.entityId, "courier-1");
  } finally {
    listener.close();
  }
});
