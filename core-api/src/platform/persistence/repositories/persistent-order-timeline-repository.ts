import { InMemoryOrderTimelineRepository } from "../../../modules/order-orchestration/in-memory-order-timeline-repository.js";
import type { OrderTimelineEntry } from "../../../modules/order-orchestration/timeline-types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "orders.timeline_entries";

function timelineKey(entry: OrderTimelineEntry): string {
  return `${entry.orderId}:${entry.occurredAt}:${entry.eventType}`;
}

export class PersistentOrderTimelineRepository extends InMemoryOrderTimelineRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async append(entry: OrderTimelineEntry): Promise<void> {
    await super.append({
      ...entry,
      details: { ...entry.details },
    });
    await this.store.put(NAMESPACE, timelineKey(entry), {
      ...entry,
      details: { ...entry.details },
    });
  }

  override async getByOrderId(orderId: string): Promise<OrderTimelineEntry[]> {
    const entries = await this.store.list<OrderTimelineEntry>(NAMESPACE);
    return entries
      .filter((entry) => entry.orderId === orderId)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .map((entry) => ({
        ...entry,
        details: { ...entry.details },
      }));
  }

  override async clear(): Promise<void> {
    // Do not clear persisted timeline state by default; rebuild writes are additive.
  }

  override async orderCount(): Promise<number> {
    const entries = await this.store.list<OrderTimelineEntry>(NAMESPACE);
    return new Set(entries.map((entry) => entry.orderId)).size;
  }
}
