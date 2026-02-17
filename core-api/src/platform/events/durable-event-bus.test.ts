import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBroker } from "../broker/in-memory-event-broker.js";
import { InMemoryDocumentStore } from "../persistence/in-memory-document-store.js";
import { DurableEventBus } from "./durable-event-bus.js";

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
