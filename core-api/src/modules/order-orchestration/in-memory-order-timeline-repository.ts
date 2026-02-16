import type { OrderTimelineEntry } from "./timeline-types.js";

export class InMemoryOrderTimelineRepository {
  private readonly entriesByOrder = new Map<string, OrderTimelineEntry[]>();

  append(entry: OrderTimelineEntry): void {
    const current = this.entriesByOrder.get(entry.orderId) ?? [];
    this.entriesByOrder.set(entry.orderId, [...current, { ...entry }]);
  }

  getByOrderId(orderId: string): OrderTimelineEntry[] {
    const entries = this.entriesByOrder.get(orderId) ?? [];
    return entries.map((entry) => ({ ...entry, details: { ...entry.details } }));
  }

  clear(): void {
    this.entriesByOrder.clear();
  }

  orderCount(): number {
    return this.entriesByOrder.size;
  }
}
