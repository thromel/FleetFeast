export type NotificationChannel = "PUSH" | "SMS" | "EMAIL";

export interface QueueNotificationInput {
  eventType: string;
  entityId: string;
  recipientId: string;
  actorType?: NotificationActorType;
  locale?: string;
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

export interface NotificationRetryRecord {
  retryId: string;
  notificationId: string;
  eventType: string;
  channel: NotificationChannel;
  entityId: string;
  attempt: number;
  delaySeconds: number;
  scheduledAt: string;
  errorCode: string;
}

export interface NotificationDeadLetterRecord {
  deadLetterId: string;
  notificationId: string;
  eventType: string;
  channel: NotificationChannel;
  entityId: string;
  finalAttempt: number;
  reason: "RETRY_CAP_REACHED" | "NON_RETRIABLE";
  errorCode: string;
  createdAt: string;
}

export interface HandleNotificationFailureInput {
  notificationId: string;
  eventType: string;
  channel: NotificationChannel;
  entityId: string;
  currentAttempt: number;
  errorCode: string;
  retriable: boolean;
}

export interface NotificationRetryDecision {
  action: "RETRY" | "DLQ";
  retry?: NotificationRetryRecord;
  deadLetter?: NotificationDeadLetterRecord;
}

export type NotificationActorType =
  | "consumer"
  | "courier"
  | "merchant_operator"
  | "support_agent";

export interface ResolveNotificationTemplateInput {
  eventType: string;
  actorType: NotificationActorType;
  locale: string;
}

export interface NotificationTemplateResolution {
  templateKey: string;
  localeUsed: string;
  localizationWarning: boolean;
}

export type NotificationDeliveryStatus = "SENT" | "DELIVERED" | "FAILED" | "ACKNOWLEDGED";

export interface RecordNotificationReceiptInput {
  notificationId: string;
  channel: NotificationChannel;
  entityId: string;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
}

export interface NotificationDeliveryReceipt {
  receiptId: string;
  notificationId: string;
  channel: NotificationChannel;
  entityId: string;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
  recordedAt: string;
}
