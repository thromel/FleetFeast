import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryNotificationQueueRepository } from "./in-memory-notification-queue-repository.js";
import { NotificationFanoutService } from "./notification-fanout-service.js";

test("fans out order events into channel notifications and emits queued events", async () => {
  const eventBus = new InMemoryEventBus();
  const queueRepository = new InMemoryNotificationQueueRepository();
  const fanoutService = new NotificationFanoutService(queueRepository, eventBus);

  const result = await fanoutService.fanout({
    eventType: "order.created.v1",
    entityId: "order-1",
    recipientId: "consumer-1",
  });

  assert.equal(result.queued.length, 2);
  const queuedEvents = eventBus.events.filter((event) => event.type === "notification.queued.v1");
  assert.equal(queuedEvents.length, 2);
});

test("fanout is idempotent for same channel/template/entity tuple", async () => {
  const eventBus = new InMemoryEventBus();
  const queueRepository = new InMemoryNotificationQueueRepository();
  const fanoutService = new NotificationFanoutService(queueRepository, eventBus);

  const first = await fanoutService.fanout({
    eventType: "dispatch.assignment.completed.v1",
    entityId: "order-99",
    recipientId: "courier-1",
  });

  const second = await fanoutService.fanout({
    eventType: "dispatch.assignment.completed.v1",
    entityId: "order-99",
    recipientId: "courier-1",
  });

  assert.equal(first.queued.length, 1);
  assert.equal(second.queued.length, 0);
  assert.equal(queueRepository.list().length, 1);
});

test("replaying the same order event does not enqueue duplicate notifications", async () => {
  const eventBus = new InMemoryEventBus();
  const queueRepository = new InMemoryNotificationQueueRepository();
  const fanoutService = new NotificationFanoutService(queueRepository, eventBus);

  const firstAttempt = await fanoutService.fanout({
    eventType: "order.created.v1",
    entityId: "order-77",
    recipientId: "consumer-77",
  });

  const replayAttempt = await fanoutService.fanout({
    eventType: "order.created.v1",
    entityId: "order-77",
    recipientId: "consumer-77",
  });

  assert.equal(firstAttempt.queued.length, 2);
  assert.equal(replayAttempt.queued.length, 0);
  assert.equal(queueRepository.list().length, 2);
  assert.equal(
    eventBus.events.filter((event) => event.type === "notification.queued.v1").length,
    2,
  );
});
