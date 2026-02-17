import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("responses include x-trace-id and logs can be queried by trace id", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);

    const traceId = healthResponse.headers.get("x-trace-id");
    assert.ok(traceId);

    const logsResponse = await fetch(
      `${baseUrl}/internal/observability/logs?traceId=${encodeURIComponent(traceId)}`,
    );
    assert.equal(logsResponse.status, 200);

    const payload = (await logsResponse.json()) as {
      logs: Array<{ traceId: string; route: string; statusCode: number }>;
    };

    assert.equal(payload.logs.length, 1);
    assert.equal(payload.logs[0]?.traceId, traceId);
    assert.equal(payload.logs[0]?.route, "/health");
    assert.equal(payload.logs[0]?.statusCode, 200);
  } finally {
    listener.close();
  }
});
