export interface OrderTimelineEntry {
  orderId: string;
  eventType: string;
  status: string;
  occurredAt: string;
  details: Record<string, unknown>;
}
