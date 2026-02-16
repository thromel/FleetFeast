import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryNotificationQueueRepository } from "./in-memory-notification-queue-repository.js";
import type {
  NotificationChannel,
  NotificationFanoutResult,
  NotificationQueueItem,
  QueueNotificationInput,
} from "./types.js";

const eventSubscriptions: Record<string, NotificationChannel[]> = {
  "order.created.v1": ["PUSH", "SMS"],
  "dispatch.assignment.completed.v1": ["PUSH"],
  "support.ticket_escalated.v1": ["EMAIL"],
};

export class NotificationFanoutService {
  constructor(
    private readonly queueRepository: InMemoryNotificationQueueRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async fanout(input: QueueNotificationInput): Promise<NotificationFanoutResult> {
    const channels = eventSubscriptions[input.eventType] ?? [];
    const queued: NotificationQueueItem[] = [];

    for (const channel of channels) {
      const templateKey = input.eventType;
      const idempotencyKey = `${channel}:${templateKey}:${input.entityId}`;

      if (this.queueRepository.hasIdempotencyKey(idempotencyKey)) {
        continue;
      }

      const queuedAt = new Date().toISOString();
      const item: NotificationQueueItem = {
        notificationId: randomUUID(),
        eventType: input.eventType,
        entityId: input.entityId,
        recipientId: input.recipientId,
        channel,
        templateKey,
        idempotencyKey,
        status: "QUEUED",
        queuedAt,
      };

      await this.queueRepository.save(item);
      this.eventBus.publish({
        type: "notification.queued.v1",
        occurredAt: queuedAt,
        payload: {
          notificationId: item.notificationId,
          eventType: item.eventType,
          entityId: item.entityId,
          channel: item.channel,
        },
      });

      queued.push(item);
    }

    return { queued };
  }
}
