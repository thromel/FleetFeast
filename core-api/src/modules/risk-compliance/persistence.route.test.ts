import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

test("queued manual review survives core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let reviewId: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const queue = await fetch(`${baseUrl}/internal/risk/manual-reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "REFUND",
        entityId: "refund-persist-1",
        orderId: "order-persist-1",
        amountCents: 7200,
        reasonCode: "HIGH_RISK_REFUND",
        requestedBy: "risk-engine",
      }),
    });

    assert.equal(queue.status, 201);
    const queued = (await queue.json()) as { reviewId: string; status: string };
    assert.equal(queued.status, "QUEUED");
    reviewId = queued.reviewId;
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
    const resolve = await fetch(
      `${baseUrl}/api/v1/admin/risk/reviews/${reviewId!}/resolve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVE",
          resolvedBy: "finance-ops-persist-1",
          note: "approved after restart",
        }),
      },
    );

    assert.equal(resolve.status, 200);
    const resolved = (await resolve.json()) as { status: string };
    assert.equal(resolved.status, "APPROVED");
  } finally {
    listenerB.close();
  }
});

test("risk policy rule overrides survive core-api restart when persistence is enabled", async () => {
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
    const updateRule = await fetch(
      `${baseUrl}/internal/risk/policy/rules/REFUND_APPROVAL`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allowUpToCents: 3500,
          reviewUpToCents: 8000,
        }),
      },
    );

    assert.equal(updateRule.status, 200);
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
    const evaluate = await fetch(`${baseUrl}/internal/risk/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "REFUND_APPROVAL",
        amountCents: 3000,
        actorId: "support-persist-1",
      }),
    });

    assert.equal(evaluate.status, 200);
    const decision = (await evaluate.json()) as { decision: string; reasonCode: string };
    assert.equal(decision.decision, "ALLOW");
    assert.equal(decision.reasonCode, "RULE_ALLOW");
  } finally {
    listenerB.close();
  }
});
