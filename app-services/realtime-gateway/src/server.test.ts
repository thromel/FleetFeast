import assert from "node:assert/strict";
import test from "node:test";

import { WebSocket } from "ws";

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
      ws.once("message", (data) => resolve(String(data)));
      ws.once("error", reject);
    });

    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    gateway.publishToChannel("consumer.order.order-1", {
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
