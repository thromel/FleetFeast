import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import type { DomainEvent } from "../../modules/identity/types.js";
import {
  createRealtimeEventRelaySubscriber,
  HttpRealtimeEventPublisher,
  type RealtimeEnvelope,
  type RealtimeEventPublisher,
} from "./realtime-event-relay.js";

class RecordingPublisher implements RealtimeEventPublisher {
  public readonly calls: Array<{ channel: string; envelope: RealtimeEnvelope }> = [];

  async publish(channel: string, envelope: RealtimeEnvelope): Promise<void> {
    this.calls.push({ channel, envelope });
  }
}

test("realtime relay publishes order events to consumer and merchant channels", async () => {
  const publisher = new RecordingPublisher();
  const relay = createRealtimeEventRelaySubscriber(publisher);

  const event: DomainEvent = {
    type: "order.created.v1",
    occurredAt: "2026-03-02T07:00:00.000Z",
    payload: {
      orderId: "order-1",
      traceId: "trace-order-created-1",
    },
  };

  await relay(event);

  const channels = publisher.calls.map((call) => call.channel).sort();
  assert.deepEqual(channels, ["consumer.order.order-1", "merchant.order.order-1"]);

  const envelope = publisher.calls[0]?.envelope;
  assert.equal(envelope?.eventType, "order.created.v1");
  assert.equal(envelope?.entityId, "order-1");
  assert.equal(envelope?.traceId, "trace-order-created-1");
});

test("realtime relay includes courier channel when assignment event has courier", async () => {
  const publisher = new RecordingPublisher();
  const relay = createRealtimeEventRelaySubscriber(publisher);

  const event: DomainEvent = {
    type: "dispatch.assignment.completed.v1",
    occurredAt: "2026-03-02T07:01:00.000Z",
    payload: {
      orderId: "order-2",
      courierId: "courier-9",
      traceId: "trace-dispatch-complete-2",
    },
  };

  await relay(event);

  const channels = publisher.calls.map((call) => call.channel).sort();
  assert.deepEqual(channels, [
    "consumer.order.order-2",
    "courier.job.order-2",
    "merchant.order.order-2",
  ]);
});

test("realtime relay ignores unsupported events without order context", async () => {
  const publisher = new RecordingPublisher();
  const relay = createRealtimeEventRelaySubscriber(publisher);

  const event: DomainEvent = {
    type: "payment.captured.v1",
    occurredAt: "2026-03-02T07:02:00.000Z",
    payload: {
      paymentIntentId: "pi-1",
      traceId: "trace-payment-1",
    },
  };

  await relay(event);

  assert.equal(publisher.calls.length, 0);
});

test("http realtime publisher posts publish payload to realtime-gateway endpoint", async () => {
  const requests: Array<{
    method: string;
    url: string;
    authHeader?: string;
    body: Record<string, unknown>;
  }> = [];

  const server = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        authHeader: request.headers["x-realtime-publish-key"] as string | undefined,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      });

      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ published: true }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind realtime publisher test listener");
    }

    const publisher = new HttpRealtimeEventPublisher({
      baseUrl: `http://127.0.0.1:${address.port}`,
      publishApiKey: "publish-key-1",
    });

    await publisher.publish("consumer.order.order-1", {
      eventType: "order.confirmed.v1",
      entityId: "order-1",
      occurredAt: "2026-03-02T07:03:00.000Z",
      traceId: "trace-publisher-1",
      payload: {
        orderId: "order-1",
      },
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/realtime/publish");
    assert.equal(requests[0]?.authHeader, "publish-key-1");
    assert.equal(requests[0]?.body.channel, "consumer.order.order-1");
  } finally {
    server.close();
  }
});
