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

test("internal risk policy rules route updates thresholds used by evaluation", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const updateRule = await fetch(
      `${baseUrl}/internal/risk/policy/rules/REFUND_APPROVAL`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allowUpToCents: 2500,
          reviewUpToCents: 7000,
        }),
      },
    );

    assert.equal(updateRule.status, 200);
    const updatedRule = (await updateRule.json()) as {
      actionType: string;
      allowUpToCents: number;
      reviewUpToCents: number;
    };
    assert.equal(updatedRule.actionType, "REFUND_APPROVAL");
    assert.equal(updatedRule.allowUpToCents, 2500);
    assert.equal(updatedRule.reviewUpToCents, 7000);

    const evaluate = await fetch(`${baseUrl}/internal/risk/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "REFUND_APPROVAL",
        amountCents: 2000,
        actorId: "support-1",
      }),
    });

    assert.equal(evaluate.status, 200);
    const decision = (await evaluate.json()) as { decision: string; reasonCode: string };
    assert.equal(decision.decision, "ALLOW");
    assert.equal(decision.reasonCode, "RULE_ALLOW");
  } finally {
    listener.close();
  }
});
