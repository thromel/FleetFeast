import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

test("notification fanout idempotency survives core-api restart when persistence is enabled", async () => {
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
    const first = await fetch(`${baseUrl}/internal/notifications/fanout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "order.created.v1",
        entityId: "order-notif-persist-1",
        recipientId: "consumer-notif-persist-1",
      }),
    });

    assert.equal(first.status, 202);
    const firstPayload = (await first.json()) as { queuedCount: number };
    assert.equal(firstPayload.queuedCount, 2);
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
    const replay = await fetch(`${baseUrl}/internal/notifications/fanout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "order.created.v1",
        entityId: "order-notif-persist-1",
        recipientId: "consumer-notif-persist-1",
      }),
    });

    assert.equal(replay.status, 202);
    const replayPayload = (await replay.json()) as { queuedCount: number };
    assert.equal(replayPayload.queuedCount, 0);
  } finally {
    listenerB.close();
  }
});

test("notification receipts survive core-api restart when persistence is enabled", async () => {
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
    const create = await fetch(`${baseUrl}/internal/notifications/receipts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notificationId: "notif-persist-1",
        channel: "SMS",
        entityId: "order-notif-persist-2",
        status: "DELIVERED",
        providerMessageId: "provider-persist-1",
      }),
    });

    assert.equal(create.status, 201);
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
    const list = await fetch(
      `${baseUrl}/internal/notifications/receipts?entityId=order-notif-persist-2`,
    );

    assert.equal(list.status, 200);
    const payload = (await list.json()) as {
      receipts: Array<{ notificationId: string; status: string }>;
    };

    assert.equal(payload.receipts.length, 1);
    assert.equal(payload.receipts[0]?.notificationId, "notif-persist-1");
    assert.equal(payload.receipts[0]?.status, "DELIVERED");
  } finally {
    listenerB.close();
  }
});
