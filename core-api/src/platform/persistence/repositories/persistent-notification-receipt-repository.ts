import { InMemoryNotificationReceiptRepository } from "../../../modules/notifications/in-memory-notification-receipt-repository.js";
import type { NotificationDeliveryReceipt } from "../../../modules/notifications/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "notifications.receipts";

export class PersistentNotificationReceiptRepository extends InMemoryNotificationReceiptRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(receipt: NotificationDeliveryReceipt): Promise<void> {
    await super.save({ ...receipt });
    await this.store.put(NAMESPACE, receipt.receiptId, { ...receipt });
  }

  override async listByEntity(entityId: string): Promise<NotificationDeliveryReceipt[]> {
    const receipts = await this.store.list<NotificationDeliveryReceipt>(NAMESPACE);
    return receipts
      .filter((receipt) => receipt.entityId === entityId)
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
      .map((receipt) => ({ ...receipt }));
  }
}
