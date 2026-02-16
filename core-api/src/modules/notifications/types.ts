export type NotificationChannel = "PUSH" | "SMS" | "EMAIL";

export interface QueueNotificationInput {
  eventType: string;
  entityId: string;
  recipientId: string;
}

export interface NotificationQueueItem {
  notificationId: string;
  eventType: string;
  entityId: string;
  recipientId: string;
  channel: NotificationChannel;
  templateKey: string;
  idempotencyKey: string;
  status: "QUEUED";
  queuedAt: string;
}

export interface NotificationFanoutResult {
  queued: NotificationQueueItem[];
}
