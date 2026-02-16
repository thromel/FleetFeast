import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryNotificationReceiptRepository } from "./in-memory-notification-receipt-repository.js";
import { NotificationReceiptService } from "./notification-receipt-service.js";

test("records delivery receipt and emits immutable delivery event", async () => {
  const eventBus = new InMemoryEventBus();
  const repository = new InMemoryNotificationReceiptRepository();
  const service = new NotificationReceiptService(repository, eventBus);

  const receipt = await service.recordReceipt({
    notificationId: "notif-1",
    channel: "SMS",
    entityId: "order-1",
    status: "DELIVERED",
    providerMessageId: "msg-1",
  });

  assert.equal(receipt.notificationId, "notif-1");
  assert.equal(receipt.status, "DELIVERED");
  const event = eventBus.events.find((candidate) => candidate.type === "notification.delivery_recorded.v1");
  assert.ok(event);
});

test("lists recorded receipts for support lookup by entity id", async () => {
  const eventBus = new InMemoryEventBus();
  const repository = new InMemoryNotificationReceiptRepository();
  const service = new NotificationReceiptService(repository, eventBus);

  await service.recordReceipt({
    notificationId: "notif-1",
    channel: "PUSH",
    entityId: "order-2",
    status: "SENT",
  });
  await service.recordReceipt({
    notificationId: "notif-2",
    channel: "EMAIL",
    entityId: "order-2",
    status: "DELIVERED",
  });

  const receipts = service.listReceiptsByEntity("order-2");
  assert.equal(receipts.length, 2);
});
