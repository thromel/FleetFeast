import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("compliance audit routes append and list immutable events", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const appendResponse = await fetch(`${baseUrl}/internal/risk/compliance/audit/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "REFUND_COMPLETED",
        actorId: "finance-ops-1",
        targetType: "REFUND",
        targetId: "refund-1",
        reasonCode: "CUSTOMER_COMPENSATION",
        metadata: { amountCents: 500 },
      }),
    });

    assert.equal(appendResponse.status, 201);

    const listResponse = await fetch(`${baseUrl}/internal/risk/compliance/audit/events`);
    assert.equal(listResponse.status, 200);
    const payload = (await listResponse.json()) as {
      events: Array<{ actionType: string; targetId: string }>;
    };

    assert.equal(payload.events.length, 1);
    assert.equal(payload.events[0]?.targetId, "refund-1");
  } finally {
    listener.close();
  }
});

test("compliance evidence route returns chain integrity report", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await fetch(`${baseUrl}/internal/risk/compliance/audit/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "PAYOUT_RELEASED",
        actorId: "finance-ops-1",
        targetType: "PAYOUT",
        targetId: "payout-1",
        reasonCode: "WEEKLY_SETTLEMENT",
        metadata: { amountCents: 1200 },
      }),
    });

    const evidenceResponse = await fetch(`${baseUrl}/internal/risk/compliance/evidence/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generatedBy: "compliance-job",
        generatedAt: "2026-02-16T12:00:00Z",
      }),
    });

    assert.equal(evidenceResponse.status, 200);
    const report = (await evidenceResponse.json()) as {
      totalEvents: number;
      chainIntegrity: boolean;
    };

    assert.equal(report.totalEvents, 1);
    assert.equal(report.chainIntegrity, true);
  } finally {
    listener.close();
  }
});
