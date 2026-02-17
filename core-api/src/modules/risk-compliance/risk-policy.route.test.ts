import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal risk policy evaluate route returns REVIEW for medium-risk refund", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/risk/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "REFUND_APPROVAL",
        amountCents: 3000,
        actorId: "support-1",
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { decision: string; reasonCode: string };
    assert.equal(payload.decision, "REVIEW");
    assert.equal(payload.reasonCode, "RULE_REVIEW");
  } finally {
    listener.close();
  }
});

test("internal risk policy evaluate route denies unknown action types", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/risk/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "UNMAPPED_ACTION",
        amountCents: 200,
        actorId: "support-1",
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { decision: string; reasonCode: string };
    assert.equal(payload.decision, "DENY");
    assert.equal(payload.reasonCode, "UNKNOWN_POLICY_PATH");
  } finally {
    listener.close();
  }
});
