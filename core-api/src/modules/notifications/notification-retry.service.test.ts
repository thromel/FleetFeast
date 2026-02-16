import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryNotificationRetryRepository } from "./in-memory-notification-retry-repository.js";
import { NotificationRetryService } from "./notification-retry-service.js";

test("schedules retry with capped exponential backoff for retriable failures", async () => {
  const eventBus = new InMemoryEventBus();
  const retryRepository = new InMemoryNotificationRetryRepository();
  const service = new NotificationRetryService(retryRepository, eventBus, 3, 10);

  const decision = await service.handleFailure({
    notificationId: "notif-1",
    eventType: "order.created.v1",
    channel: "SMS",
    entityId: "order-1",
    currentAttempt: 1,
    errorCode: "SMS_TIMEOUT",
    retriable: true,
  });

  assert.equal(decision.action, "RETRY");
  assert.equal(decision.retry?.attempt, 2);
  assert.equal(decision.retry?.delaySeconds, 20);
  const retryEvent = eventBus.events.find((event) => event.type === "notification.retry_scheduled.v1");
  assert.ok(retryEvent);
});

test("routes notification to DLQ when retry cap is reached", async () => {
  const eventBus = new InMemoryEventBus();
  const retryRepository = new InMemoryNotificationRetryRepository();
  const service = new NotificationRetryService(retryRepository, eventBus, 3, 10);

  const decision = await service.handleFailure({
    notificationId: "notif-2",
    eventType: "order.created.v1",
    channel: "PUSH",
    entityId: "order-2",
    currentAttempt: 3,
    errorCode: "PROVIDER_DOWN",
    retriable: true,
  });

  assert.equal(decision.action, "DLQ");
  assert.equal(decision.deadLetter?.reason, "RETRY_CAP_REACHED");
  const failedEvent = eventBus.events.find((event) => event.type === "notification.delivery_failed.v1");
  assert.ok(failedEvent);
});
