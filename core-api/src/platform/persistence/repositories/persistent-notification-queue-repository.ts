import { InMemoryNotificationQueueRepository } from "../../../modules/notifications/in-memory-notification-queue-repository.js";
import type { NotificationQueueItem } from "../../../modules/notifications/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "notifications.queue";

export class PersistentNotificationQueueRepository extends InMemoryNotificationQueueRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(item: NotificationQueueItem): Promise<void> {
    await super.save({ ...item });
    await this.store.put(NAMESPACE, item.notificationId, { ...item });
  }

  override async hasIdempotencyKey(idempotencyKey: string): Promise<boolean> {
    const queued = await this.store.list<NotificationQueueItem>(NAMESPACE);
    return queued.some((item) => item.idempotencyKey === idempotencyKey);
  }
}
