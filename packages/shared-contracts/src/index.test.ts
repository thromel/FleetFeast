import assert from "node:assert/strict";
import test from "node:test";

import { createAppSession, isRealtimeEnvelope } from "./index.js";

test("createAppSession returns scoped session metadata", () => {
  const session = createAppSession({
    sessionId: "sess-1",
    userId: "user-1",
    role: "consumer",
    persona: "consumer",
    traceId: "trace-1",
    refreshTokenId: "refresh-1",
    expiresInSeconds: 900,
  });

  assert.equal(session.sessionId, "sess-1");
  assert.equal(session.persona, "consumer");
  assert.equal(session.role, "consumer");
  assert.ok(session.expiresAt.length > 0);
});

test("isRealtimeEnvelope validates app realtime payload shape", () => {
  const valid = isRealtimeEnvelope({
    eventType: "dispatch.assignment.completed.v1",
    entityId: "order-1",
    occurredAt: new Date().toISOString(),
    traceId: "trace-1",
    payload: {
      courierId: "courier-1",
      etaSeconds: 640,
    },
  });

  assert.equal(valid, true);
});
