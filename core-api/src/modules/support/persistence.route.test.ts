import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

test("support ticket survives core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let ticketId: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const create = await fetch(`${baseUrl}/api/v1/support/tickets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order-support-persist-1",
        actorId: "consumer-support-persist-1",
        issueType: "PAYMENT_ISSUE",
        summary: "Need persisted support context",
      }),
    });

    assert.equal(create.status, 201);
    const ticket = (await create.json()) as { ticketId: string; status: string };
    assert.equal(ticket.status, "OPEN");
    ticketId = ticket.ticketId;
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
    const timeline = await fetch(`${baseUrl}/api/v1/support/tickets/${ticketId!}/timeline`);

    assert.equal(timeline.status, 200);
    const payload = (await timeline.json()) as {
      ticket: { ticketId: string; status: string };
      entries: unknown[];
    };
    assert.equal(payload.ticket.ticketId, ticketId);
    assert.equal(payload.ticket.status, "OPEN");
    assert.ok(Array.isArray(payload.entries));
  } finally {
    listenerB.close();
  }
});
