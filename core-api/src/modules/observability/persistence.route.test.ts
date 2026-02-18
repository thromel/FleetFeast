import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryDocumentStore } from "../../platform/persistence/in-memory-document-store.js";
import { createServer } from "../../server.js";

test("observability logs survive core-api restart when persistence is enabled", async () => {
  const documentStore = new InMemoryDocumentStore();

  const appA = createServer({
    enablePersistence: true,
    documentStore,
  });
  const listenerA = appA.listen(0);

  let traceId: string;
  try {
    const address = listenerA.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);

    const candidateTraceId = health.headers.get("x-trace-id");
    assert.ok(candidateTraceId);
    traceId = candidateTraceId;
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
    const logs = await fetch(
      `${baseUrl}/internal/observability/logs?traceId=${encodeURIComponent(traceId!)}`,
    );
    assert.equal(logs.status, 200);

    const payload = (await logs.json()) as {
      logs: Array<{ traceId: string; route: string; statusCode: number }>;
    };
    assert.equal(payload.logs.length, 1);
    assert.equal(payload.logs[0]?.traceId, traceId);
    assert.equal(payload.logs[0]?.route, "/health");
    assert.equal(payload.logs[0]?.statusCode, 200);
  } finally {
    listenerB.close();
  }
});
