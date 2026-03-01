import assert from "node:assert/strict";
import test from "node:test";

import {
  HttpRealtimeEventForwarder,
  resolveRealtimeTarget,
} from "./realtime-event-forwarder.js";

// ---------------------------------------------------------------------------
// resolveRealtimeTarget – channel mapping
// ---------------------------------------------------------------------------

test("resolveRealtimeTarget maps order.created.v1 to consumer.order channel", () => {
  const result = resolveRealtimeTarget({
    type: "order.created.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-abc" },
  });

  assert.ok(result);
  assert.equal(result.channel, "consumer.order.order-abc");
  assert.equal(result.entityId, "order-abc");
});

test("resolveRealtimeTarget maps order.confirmed.v1 to consumer.order channel", () => {
  const result = resolveRealtimeTarget({
    type: "order.confirmed.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-abc" },
  });

  assert.ok(result);
  assert.equal(result.channel, "consumer.order.order-abc");
});

test("resolveRealtimeTarget maps order.cancelled.v1 to consumer.order channel", () => {
  const result = resolveRealtimeTarget({
    type: "order.cancelled.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-abc" },
  });

  assert.ok(result);
  assert.equal(result.channel, "consumer.order.order-abc");
});

test("resolveRealtimeTarget maps order.cancel_requested.v1 to consumer.order channel", () => {
  const result = resolveRealtimeTarget({
    type: "order.cancel_requested.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-abc" },
  });

  assert.ok(result);
  assert.equal(result.channel, "consumer.order.order-abc");
});

test("resolveRealtimeTarget maps order.picked_up.v1 to consumer.order channel", () => {
  const result = resolveRealtimeTarget({
    type: "order.picked_up.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-abc" },
  });

  assert.ok(result);
  assert.equal(result.channel, "consumer.order.order-abc");
});

test("resolveRealtimeTarget maps order.delivered.v1 to consumer.order channel", () => {
  const result = resolveRealtimeTarget({
    type: "order.delivered.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-abc" },
  });

  assert.ok(result);
  assert.equal(result.channel, "consumer.order.order-abc");
});

test("resolveRealtimeTarget maps dispatch.assignment.requested.v1 to courier.job channel", () => {
  const result = resolveRealtimeTarget({
    type: "dispatch.assignment.requested.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-xyz" },
  });

  assert.ok(result);
  assert.equal(result.channel, "courier.job.order-xyz");
  assert.equal(result.entityId, "order-xyz");
});

test("resolveRealtimeTarget maps dispatch.assignment.completed.v1 to courier.job channel", () => {
  const result = resolveRealtimeTarget({
    type: "dispatch.assignment.completed.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-xyz" },
  });

  assert.ok(result);
  assert.equal(result.channel, "courier.job.order-xyz");
});

test("resolveRealtimeTarget returns null for unknown event type", () => {
  const result = resolveRealtimeTarget({
    type: "identity.user_registered.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { userId: "user-1" },
  });

  assert.equal(result, null);
});

test("resolveRealtimeTarget returns null when payload has no orderId", () => {
  const result = resolveRealtimeTarget({
    type: "order.created.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { checkoutId: "checkout-1" },
  });

  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// HttpRealtimeEventForwarder – HTTP publish integration
// ---------------------------------------------------------------------------

test("HttpRealtimeEventForwarder posts correct channel and envelope for order event", async () => {
  const captured: { url: string; options: RequestInit }[] = [];

  const forwarder = new HttpRealtimeEventForwarder({
    realtimeGatewayBaseUrl: "http://127.0.0.1:4104",
    fetchImpl: async (url, options) => {
      captured.push({ url: String(url), options: options ?? {} });
      return new Response(JSON.stringify({ published: true }), { status: 200 });
    },
  });

  await forwarder.forward({
    type: "order.created.v1",
    occurredAt: "2026-03-01T10:00:00.000Z",
    payload: { orderId: "order-1", checkoutId: "checkout-1" },
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.url, "http://127.0.0.1:4104/app/v1/realtime/publish");

  const body = JSON.parse(captured[0]?.options.body as string) as {
    channel: string;
    envelope: { eventType: string; entityId: string; occurredAt: string; traceId: string; payload: Record<string, unknown> };
  };
  assert.equal(body.channel, "consumer.order.order-1");
  assert.equal(body.envelope.eventType, "order.created.v1");
  assert.equal(body.envelope.entityId, "order-1");
  assert.equal(body.envelope.occurredAt, "2026-03-01T10:00:00.000Z");
  assert.equal(typeof body.envelope.traceId, "string");
  assert.ok(body.envelope.traceId.length > 0);
  assert.deepEqual(body.envelope.payload, { orderId: "order-1", checkoutId: "checkout-1" });
});

test("HttpRealtimeEventForwarder posts correct channel for dispatch event", async () => {
  const captured: { url: string; body: { channel: string; envelope: { eventType: string } } }[] = [];

  const forwarder = new HttpRealtimeEventForwarder({
    realtimeGatewayBaseUrl: "http://127.0.0.1:4104",
    fetchImpl: async (url, options) => {
      captured.push({
        url: String(url),
        body: JSON.parse((options?.body ?? "{}") as string) as { channel: string; envelope: { eventType: string } },
      });
      return new Response(JSON.stringify({ published: true }), { status: 200 });
    },
  });

  await forwarder.forward({
    type: "dispatch.assignment.completed.v1",
    occurredAt: "2026-03-01T10:00:00.000Z",
    payload: { orderId: "order-2", courierId: "courier-9" },
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.body.channel, "courier.job.order-2");
  assert.equal(captured[0]?.body.envelope.eventType, "dispatch.assignment.completed.v1");
});

test("HttpRealtimeEventForwarder adds publish API key header when configured", async () => {
  const capturedHeaders: Record<string, string>[] = [];

  const forwarder = new HttpRealtimeEventForwarder({
    realtimeGatewayBaseUrl: "http://127.0.0.1:4104",
    publishApiKey: "test-api-key",
    fetchImpl: async (_url, options) => {
      capturedHeaders.push((options?.headers ?? {}) as Record<string, string>);
      return new Response(JSON.stringify({ published: true }), { status: 200 });
    },
  });

  await forwarder.forward({
    type: "order.confirmed.v1",
    occurredAt: "2026-03-01T10:00:00.000Z",
    payload: { orderId: "order-3" },
  });

  assert.equal(capturedHeaders.length, 1);
  assert.equal(capturedHeaders[0]?.["x-realtime-publish-key"], "test-api-key");
});

test("HttpRealtimeEventForwarder skips unmapped events without calling fetch", async () => {
  let fetchCalled = false;

  const forwarder = new HttpRealtimeEventForwarder({
    realtimeGatewayBaseUrl: "http://127.0.0.1:4104",
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ published: true }), { status: 200 });
    },
  });

  await forwarder.forward({
    type: "identity.session_issued.v1",
    occurredAt: "2026-03-01T10:00:00.000Z",
    payload: { userId: "user-1" },
  });

  assert.equal(fetchCalled, false);
});

test("HttpRealtimeEventForwarder strips trailing slash from base URL", async () => {
  const captured: string[] = [];

  const forwarder = new HttpRealtimeEventForwarder({
    realtimeGatewayBaseUrl: "http://127.0.0.1:4104/",
    fetchImpl: async (url) => {
      captured.push(String(url));
      return new Response(JSON.stringify({ published: true }), { status: 200 });
    },
  });

  await forwarder.forward({
    type: "order.delivered.v1",
    occurredAt: "2026-03-01T10:00:00.000Z",
    payload: { orderId: "order-4" },
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0], "http://127.0.0.1:4104/app/v1/realtime/publish");
});
