import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

test("compliance audit events survive core-api restart when persistence is enabled", async () => {
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
    const append = await fetch(`${baseUrl}/internal/risk/compliance/audit/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: "ADMIN_BREAK_GLASS",
        actorId: "system-admin-persist-1",
        targetType: "PRIVILEGED_ACCESS",
        targetId: "system-admin-persist-1",
        reasonCode: "INCIDENT_RESPONSE",
        metadata: {
          justification: "production incident",
        },
      }),
    });

    assert.equal(append.status, 201);
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
    const list = await fetch(`${baseUrl}/internal/risk/compliance/audit/events`);

    assert.equal(list.status, 200);
    const payload = (await list.json()) as {
      events: Array<{ actionType: string; reasonCode: string }>;
    };

    assert.equal(payload.events.length, 1);
    assert.equal(payload.events[0]?.actionType, "ADMIN_BREAK_GLASS");
    assert.equal(payload.events[0]?.reasonCode, "INCIDENT_RESPONSE");
  } finally {
    listenerB.close();
  }
});
