import { InMemoryNotificationRetryRepository } from "../../../modules/notifications/in-memory-notification-retry-repository.js";
import type {
  NotificationDeadLetterRecord,
  NotificationRetryRecord,
} from "../../../modules/notifications/types.js";
import type { DocumentStore } from "../document-store.js";

const RETRY_NAMESPACE = "notifications.retries";
const DLQ_NAMESPACE = "notifications.dead_letters";

export class PersistentNotificationRetryRepository extends InMemoryNotificationRetryRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async saveRetry(record: NotificationRetryRecord): Promise<void> {
    await super.saveRetry({ ...record });
    await this.store.put(RETRY_NAMESPACE, record.retryId, { ...record });
  }

  override async saveDeadLetter(record: NotificationDeadLetterRecord): Promise<void> {
    await super.saveDeadLetter({ ...record });
    await this.store.put(DLQ_NAMESPACE, record.deadLetterId, { ...record });
  }
}
