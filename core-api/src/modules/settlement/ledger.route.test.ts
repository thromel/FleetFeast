import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal settlement ledger route accepts balanced journals", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/settlement/ledger/entries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: "PAYMENT_CAPTURE",
        sourceId: "payment-intent-1",
        lines: [
          { account: "cash.clearing", side: "DEBIT", amount: 1912 },
          { account: "liability.merchant_payable", side: "CREDIT", amount: 1912 },
        ],
      }),
    });

    assert.equal(response.status, 201);
    const payload = (await response.json()) as { sourceType: string };
    assert.equal(payload.sourceType, "PAYMENT_CAPTURE");
  } finally {
    listener.close();
  }
});

test("internal settlement ledger route rejects unbalanced journals", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/settlement/ledger/entries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: "REFUND",
        sourceId: "refund-1",
        lines: [
          { account: "liability.merchant_payable", side: "DEBIT", amount: 500 },
          { account: "cash.clearing", side: "CREDIT", amount: 450 },
        ],
      }),
    });

    assert.equal(response.status, 409);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "SETTLEMENT_UNBALANCED_JOURNAL");
  } finally {
    listener.close();
  }
});
