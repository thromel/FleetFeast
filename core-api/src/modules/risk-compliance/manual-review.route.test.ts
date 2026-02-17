import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("manual review routes queue and resolve review", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const queueResponse = await fetch(`${baseUrl}/internal/risk/manual-reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "REFUND",
        entityId: "refund-1",
        orderId: "order-1",
        amountCents: 7000,
        reasonCode: "HIGH_RISK_REFUND",
        requestedBy: "risk-engine",
      }),
    });

    assert.equal(queueResponse.status, 201);
    const queued = (await queueResponse.json()) as { reviewId: string; status: string };
    assert.equal(queued.status, "QUEUED");

    const resolveResponse = await fetch(
      `${baseUrl}/api/v1/admin/risk/reviews/${queued.reviewId}/resolve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVE",
          resolvedBy: "finance-ops-1",
          note: "approved",
        }),
      },
    );

    assert.equal(resolveResponse.status, 200);
    const resolved = (await resolveResponse.json()) as { status: string };
    assert.equal(resolved.status, "APPROVED");
  } finally {
    listener.close();
  }
});

test("manual review resolve route returns 404 for unknown review", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/v1/admin/risk/reviews/missing/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision: "REJECT",
        resolvedBy: "finance-ops-1",
      }),
    });

    assert.equal(response.status, 404);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "RISK_MANUAL_REVIEW_NOT_FOUND");
  } finally {
    listener.close();
  }
});
