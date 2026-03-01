import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBroker } from "../broker/in-memory-event-broker.js";
import { InMemoryDocumentStore } from "../persistence/in-memory-document-store.js";
import type { RealtimeEventForwarder } from "../realtime/realtime-event-forwarder.js";
import { DurableEventBus } from "./durable-event-bus.js";

test("durable event bus hydrates existing outbox events on startup", async () => {
  const documentStore = new InMemoryDocumentStore();
  await documentStore.put("platform.event_outbox", "evt-1", {
    type: "order.created.v1",
    occurredAt: "2026-02-17T00:00:00.000Z",
    payload: {
      orderId: "order-preexisting-1",
    },
  });

  const eventBus = new DurableEventBus(documentStore);
  await eventBus.flush();

  assert.equal(eventBus.events.length, 1);
  assert.equal(eventBus.events[0]?.type, "order.created.v1");
});

test("durable event bus appends events to outbox store and publishes broker messages", async () => {
  const documentStore = new InMemoryDocumentStore();
  const broker = new InMemoryEventBroker();
  const eventBus = new DurableEventBus(documentStore, broker);

  eventBus.publish({
    type: "order.created.v1",
    occurredAt: "2026-02-17T00:00:00.000Z",
    payload: {
      orderId: "order-1",
    },
  });

  await eventBus.flush();

  assert.equal(eventBus.events.length, 1);

  const outbox = await documentStore.listEntries<{ type: string }>("platform.event_outbox");
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]?.value.type, "order.created.v1");

  assert.equal(broker.messages.length, 1);
  assert.equal(broker.messages[0]?.topic, "order.created.v1");
});

test("durable event bus calls realtime forwarder for each published event", async () => {
  const forwarded: Array<{ type: string }> = [];
  const forwarder: RealtimeEventForwarder = {
    async forward(event) {
      forwarded.push({ type: event.type });
    },
  };

  const eventBus = new DurableEventBus(undefined, undefined, "platform.event_outbox", forwarder);

  eventBus.publish({
    type: "order.created.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-rt-1" },
  });

  eventBus.publish({
    type: "dispatch.assignment.completed.v1",
    occurredAt: "2026-03-01T00:00:00.000Z",
    payload: { orderId: "order-rt-1", courierId: "courier-1" },
  });

  await eventBus.flush();

  assert.equal(forwarded.length, 2);
  assert.equal(forwarded[0]?.type, "order.created.v1");
  assert.equal(forwarded[1]?.type, "dispatch.assignment.completed.v1");
});
