import assert from "node:assert/strict";
import test from "node:test";

import { WebSocket } from "ws";

import type { PushFallbackMessage } from "./push-fallback.js";
import { createRealtimeGatewayServer } from "./server.js";

test("realtime gateway accepts websocket connections and publishes channel events", async () => {
  const gateway = createRealtimeGatewayServer();
  await gateway.app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = gateway.app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind realtime gateway test listener");
    }

    const ws = new WebSocket(
      `ws://127.0.0.1:${address.port}/app/v1/realtime/connect?channel=consumer.order.order-1`,
    );

    const messagePromise = new Promise<string>((resolve, reject) => {
      ws.once("message", (data: import("ws").RawData) => resolve(String(data)));
      ws.once("error", reject);
    });

    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    await gateway.publishToChannel("consumer.order.order-1", {
      eventType: "order.confirmed.v1",
      entityId: "order-1",
      occurredAt: new Date().toISOString(),
      traceId: "trace-rt-1",
      payload: { status: "MERCHANT_ACCEPTED" },
    });

    const message = await messagePromise;
    const parsed = JSON.parse(message) as { eventType: string; entityId: string };
    assert.equal(parsed.eventType, "order.confirmed.v1");
    assert.equal(parsed.entityId, "order-1");

    ws.close();
  } finally {
    await gateway.app.close();
  }
});

test("realtime gateway sends push fallback when channel has no active socket", async () => {
  const pushed: PushFallbackMessage[] = [];
  const gateway = createRealtimeGatewayServer({
    pushFallbackNotifier: {
      async send(message: PushFallbackMessage): Promise<void> {
        pushed.push(message);
      },
    },
  });
  await gateway.app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = gateway.app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind realtime gateway test listener");
    }

    const register = await fetch(`http://127.0.0.1:${address.port}/app/v1/realtime/push/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "courier.job.job-1",
        userId: "courier-1",
        pushToken: "token-1",
        provider: "fcm",
      }),
    });
    assert.equal(register.status, 200);

    await gateway.publishToChannel("courier.job.job-1", {
      eventType: "dispatch.assignment.completed.v1",
      entityId: "job-1",
      occurredAt: new Date().toISOString(),
      traceId: "trace-fallback-1",
      payload: { orderId: "order-1" },
    });

    assert.equal(pushed.length, 1);
    assert.equal(pushed[0]?.target.userId, "courier-1");
    assert.equal(pushed[0]?.target.provider, "fcm");
    assert.equal(pushed[0]?.reason, "NO_ACTIVE_SOCKET");
  } finally {
    await gateway.app.close();
  }
});

test("realtime gateway does not send push fallback while socket is active", async () => {
  const pushed: PushFallbackMessage[] = [];
  const gateway = createRealtimeGatewayServer({
    pushFallbackNotifier: {
      async send(message: PushFallbackMessage): Promise<void> {
        pushed.push(message);
      },
    },
  });
  await gateway.app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = gateway.app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind realtime gateway test listener");
    }

    const register = await fetch(`http://127.0.0.1:${address.port}/app/v1/realtime/push/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "consumer.order.order-2",
        userId: "consumer-1",
        pushToken: "token-2",
        provider: "apns",
      }),
    });
    assert.equal(register.status, 200);

    const ws = new WebSocket(
      `ws://127.0.0.1:${address.port}/app/v1/realtime/connect?channel=consumer.order.order-2`,
    );

    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    await gateway.publishToChannel("consumer.order.order-2", {
      eventType: "order.confirmed.v1",
      entityId: "order-2",
      occurredAt: new Date().toISOString(),
      traceId: "trace-realtime-2",
      payload: { status: "COURIER_ASSIGNED" },
    });

    assert.equal(pushed.length, 0);
    ws.close();
  } finally {
    await gateway.app.close();
  }
});

test("realtime publish endpoint fans out to connected websocket channel", async () => {
  const gateway = createRealtimeGatewayServer();
  await gateway.app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = gateway.app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind realtime gateway test listener");
    }

    const ws = new WebSocket(
      `ws://127.0.0.1:${address.port}/app/v1/realtime/connect?channel=merchant.order.order-99`,
    );

    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    const messagePromise = new Promise<string>((resolve, reject) => {
      ws.once("message", (data: import("ws").RawData) => resolve(String(data)));
      ws.once("error", reject);
    });

    const publishResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/realtime/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "merchant.order.order-99",
        envelope: {
          eventType: "order.confirmed.v1",
          entityId: "order-99",
          occurredAt: new Date().toISOString(),
          traceId: "trace-publish-route-1",
          payload: { status: "MERCHANT_ACCEPTED" },
        },
      }),
    });

    assert.equal(publishResponse.status, 200);
    const publishedPayload = (await publishResponse.json()) as { published: boolean };
    assert.equal(publishedPayload.published, true);

    const message = await messagePromise;
    const parsed = JSON.parse(message) as { entityId: string };
    assert.equal(parsed.entityId, "order-99");
    ws.close();
  } finally {
    await gateway.app.close();
  }
});

test("realtime publish endpoint enforces API key when configured", async () => {
  const previousApiKey = process.env.REALTIME_PUBLISH_API_KEY;
  process.env.REALTIME_PUBLISH_API_KEY = "publish-key-1";

  const gateway = createRealtimeGatewayServer();
  await gateway.app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = gateway.app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind realtime gateway test listener");
    }

    const unauthorized = await fetch(`http://127.0.0.1:${address.port}/app/v1/realtime/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "admin.incident.incident-1",
        envelope: {
          eventType: "incident.created.v1",
          entityId: "incident-1",
          occurredAt: new Date().toISOString(),
          traceId: "trace-publish-authz-1",
          payload: { severity: "HIGH" },
        },
      }),
    });

    assert.equal(unauthorized.status, 401);
  } finally {
    await gateway.app.close();
    if (previousApiKey === undefined) {
      delete process.env.REALTIME_PUBLISH_API_KEY;
    } else {
      process.env.REALTIME_PUBLISH_API_KEY = previousApiKey;
    }
  }
});
