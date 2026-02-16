import type {
  NotificationDeadLetterRecord,
  NotificationRetryRecord,
} from "./types.js";

export class InMemoryNotificationRetryRepository {
  private readonly retries: NotificationRetryRecord[] = [];
  private readonly deadLetters: NotificationDeadLetterRecord[] = [];

  async saveRetry(record: NotificationRetryRecord): Promise<void> {
    this.retries.push(record);
  }

  async saveDeadLetter(record: NotificationDeadLetterRecord): Promise<void> {
    this.deadLetters.push(record);
  }

  listRetries(): NotificationRetryRecord[] {
    return [...this.retries];
  }

  listDeadLetters(): NotificationDeadLetterRecord[] {
    return [...this.deadLetters];
  }
}
