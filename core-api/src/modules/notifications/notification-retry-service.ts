import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryNotificationRetryRepository } from "./in-memory-notification-retry-repository.js";
import type {
  HandleNotificationFailureInput,
  NotificationRetryDecision,
} from "./types.js";

export class NotificationRetryService {
  constructor(
    private readonly retryRepository: InMemoryNotificationRetryRepository,
    private readonly eventBus: InMemoryEventBus,
    private readonly maxRetries: number = 3,
    private readonly baseDelaySeconds: number = 10,
    private readonly maxBackoffSeconds: number = 300,
  ) {}

  async handleFailure(input: HandleNotificationFailureInput): Promise<NotificationRetryDecision> {
    if (input.retriable && input.currentAttempt < this.maxRetries) {
      const attempt = input.currentAttempt + 1;
      const delaySeconds = Math.min(
        this.baseDelaySeconds * 2 ** input.currentAttempt,
        this.maxBackoffSeconds,
      );
      const scheduledAt = new Date().toISOString();
      const retry = {
        retryId: randomUUID(),
        notificationId: input.notificationId,
        eventType: input.eventType,
        channel: input.channel,
        entityId: input.entityId,
        attempt,
        delaySeconds,
        scheduledAt,
        errorCode: input.errorCode,
      };

      await this.retryRepository.saveRetry(retry);
      this.eventBus.publish({
        type: "notification.retry_scheduled.v1",
        occurredAt: scheduledAt,
        payload: {
          retryId: retry.retryId,
          notificationId: retry.notificationId,
          attempt: retry.attempt,
          delaySeconds: retry.delaySeconds,
        },
      });

      return {
        action: "RETRY",
        retry,
      };
    }

    const reason: "RETRY_CAP_REACHED" | "NON_RETRIABLE" = input.retriable
      ? "RETRY_CAP_REACHED"
      : "NON_RETRIABLE";
    const createdAt = new Date().toISOString();
    const deadLetter = {
      deadLetterId: randomUUID(),
      notificationId: input.notificationId,
      eventType: input.eventType,
      channel: input.channel,
      entityId: input.entityId,
      finalAttempt: input.currentAttempt,
      reason,
      errorCode: input.errorCode,
      createdAt,
    };

    await this.retryRepository.saveDeadLetter(deadLetter);
    this.eventBus.publish({
      type: "notification.delivery_failed.v1",
      occurredAt: createdAt,
      payload: {
        deadLetterId: deadLetter.deadLetterId,
        notificationId: deadLetter.notificationId,
        reason: deadLetter.reason,
      },
    });

    return {
      action: "DLQ",
      deadLetter,
    };
  }
}
