import type { NotificationQueueItem } from "./types.js";

export class InMemoryNotificationQueueRepository {
  private readonly queue = new Map<string, NotificationQueueItem>();
  private readonly idempotencyKeys = new Set<string>();

  async save(item: NotificationQueueItem): Promise<void> {
    this.queue.set(item.notificationId, item);
    this.idempotencyKeys.add(item.idempotencyKey);
  }

  async hasIdempotencyKey(idempotencyKey: string): Promise<boolean> {
    return this.idempotencyKeys.has(idempotencyKey);
  }

  list(): NotificationQueueItem[] {
    return [...this.queue.values()].sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
  }
}
