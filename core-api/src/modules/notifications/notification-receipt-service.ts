import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryNotificationReceiptRepository } from "./in-memory-notification-receipt-repository.js";
import type {
  NotificationDeliveryReceipt,
  RecordNotificationReceiptInput,
} from "./types.js";

export class NotificationReceiptService {
  constructor(
    private readonly repository: InMemoryNotificationReceiptRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async recordReceipt(input: RecordNotificationReceiptInput): Promise<NotificationDeliveryReceipt> {
    const recordedAt = new Date().toISOString();
    const receipt: NotificationDeliveryReceipt = {
      receiptId: randomUUID(),
      notificationId: input.notificationId,
      channel: input.channel,
      entityId: input.entityId,
      status: input.status,
      providerMessageId: input.providerMessageId,
      recordedAt,
    };

    await this.repository.save(receipt);
    this.eventBus.publish({
      type: "notification.delivery_recorded.v1",
      occurredAt: recordedAt,
      payload: {
        receiptId: receipt.receiptId,
        notificationId: receipt.notificationId,
        channel: receipt.channel,
        status: receipt.status,
      },
    });

    return receipt;
  }

  listReceiptsByEntity(entityId: string): NotificationDeliveryReceipt[] {
    return this.repository.listByEntity(entityId);
  }
}
