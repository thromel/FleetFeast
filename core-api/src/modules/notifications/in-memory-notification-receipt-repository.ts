import type { NotificationDeliveryReceipt } from "./types.js";

export class InMemoryNotificationReceiptRepository {
  private readonly receipts: NotificationDeliveryReceipt[] = [];

  async save(receipt: NotificationDeliveryReceipt): Promise<void> {
    this.receipts.push(receipt);
  }

  listByEntity(entityId: string): NotificationDeliveryReceipt[] {
    return this.receipts
      .filter((receipt) => receipt.entityId === entityId)
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  }
}
