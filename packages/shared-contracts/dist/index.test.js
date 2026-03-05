import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoSurfaceLinks, createAppSession, describeOrderStage, isRealtimeEnvelope, } from "./index.js";
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
test("buildDemoSurfaceLinks marks the current surface and preserves default demo ports", () => {
    const links = buildDemoSurfaceLinks("merchant");
    assert.equal(links.length, 4);
    assert.deepEqual(links.map((link) => [link.id, link.isCurrent, link.href]), [
        ["consumer", false, "http://127.0.0.1:3003"],
        ["merchant", true, "http://127.0.0.1:3001"],
        ["courier", false, "http://127.0.0.1:3004"],
        ["admin", false, "http://127.0.0.1:3002"],
    ]);
});
test("describeOrderStage groups backend statuses into client-demo steps", () => {
    assert.deepEqual(describeOrderStage("CREATED"), {
        label: "Awaiting Merchant",
        persona: "merchant",
        tone: "attention",
    });
    assert.deepEqual(describeOrderStage("DISPATCH_PENDING"), {
        label: "Dispatching",
        persona: "merchant",
        tone: "active",
    });
    assert.deepEqual(describeOrderStage("COURIER_ASSIGNED"), {
        label: "Courier En Route",
        persona: "courier",
        tone: "active",
    });
    assert.deepEqual(describeOrderStage("DELIVERED"), {
        label: "Completed",
        persona: "consumer",
        tone: "complete",
    });
});
//# sourceMappingURL=index.test.js.map