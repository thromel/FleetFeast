import type { OrderTimelineEntry } from "./timeline-types.js";

export class InMemoryOrderTimelineRepository {
  private readonly entriesByOrder = new Map<string, OrderTimelineEntry[]>();

  async append(entry: OrderTimelineEntry): Promise<void> {
    const current = this.entriesByOrder.get(entry.orderId) ?? [];
    this.entriesByOrder.set(entry.orderId, [...current, { ...entry }]);
  }

  async getByOrderId(orderId: string): Promise<OrderTimelineEntry[]> {
    const entries = this.entriesByOrder.get(orderId) ?? [];
    return entries.map((entry) => ({ ...entry, details: { ...entry.details } }));
  }

  async clear(): Promise<void> {
    this.entriesByOrder.clear();
  }

  async orderCount(): Promise<number> {
    return this.entriesByOrder.size;
  }
}
