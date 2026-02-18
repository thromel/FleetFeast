import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

async function createSupportTicket(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/support/tickets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderId: "order-support-sla-persist-1",
      actorId: "consumer-support-sla-persist-1",
      issueType: "PAYMENT_ISSUE",
      summary: "Need escalation continuity",
    }),
  });

  assert.equal(response.status, 201);
}

async function evaluateEscalations(baseUrl: string, evaluatedAt: string): Promise<number> {
  const response = await fetch(`${baseUrl}/internal/support/sla/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ evaluatedAt }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { escalatedCount: number };
  return payload.escalatedCount;
}

test("support SLA escalation remains consistent across restarts when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();
  const evaluatedAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

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
    await createSupportTicket(baseUrl);
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
    const escalatedCount = await evaluateEscalations(baseUrl, evaluatedAt);
    assert.equal(escalatedCount, 1);
  } finally {
    listenerB.close();
  }

  const appC = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerC = appC.listen(0);

  try {
    const address = listenerC.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const escalatedCount = await evaluateEscalations(baseUrl, evaluatedAt);
    assert.equal(escalatedCount, 0);
  } finally {
    listenerC.close();
  }
});
