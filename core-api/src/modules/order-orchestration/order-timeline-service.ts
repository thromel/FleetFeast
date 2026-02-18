import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import type { DomainEvent } from "../identity/types.js";
import { InMemoryOrderTimelineRepository } from "./in-memory-order-timeline-repository.js";
import type { OrderTimelineEntry } from "./timeline-types.js";

interface RebuildSummary {
  entriesRebuilt: number;
  ordersRebuilt: number;
}

const eventStatusMap: Record<string, string> = {
  "order.created.v1": "CREATED",
  "order.confirmed.v1": "MERCHANT_ACCEPTED",
  "dispatch.assignment.requested.v1": "DISPATCH_PENDING",
  "dispatch.assignment.completed.v1": "COURIER_ASSIGNED",
  "order.picked_up.v1": "PICKED_UP",
  "order.delivered.v1": "DELIVERED",
  "order.cancel_requested.v1": "CANCEL_REQUESTED",
  "order.cancelled.v1": "CANCELLED",
};

export class OrderTimelineService {
  constructor(
    private readonly eventBus: InMemoryEventBus,
    private readonly repository: InMemoryOrderTimelineRepository,
  ) {}

  async projectEvent(event: DomainEvent): Promise<void> {
    const entry = this.toTimelineEntry(event);
    if (!entry) {
      return;
    }

    await this.repository.append(entry);
  }

  async getTimeline(orderId: string): Promise<OrderTimelineEntry[]> {
    return this.repository.getByOrderId(orderId);
  }

  async rebuildFromEventLog(): Promise<RebuildSummary> {
    await this.repository.clear();
    let entriesRebuilt = 0;

    for (const event of this.eventBus.events) {
      const entry = this.toTimelineEntry(event);
      if (!entry) {
        continue;
      }

      await this.repository.append(entry);
      entriesRebuilt += 1;
    }

    return {
      entriesRebuilt,
      ordersRebuilt: await this.repository.orderCount(),
    };
  }

  private toTimelineEntry(event: DomainEvent): OrderTimelineEntry | null {
    const status = eventStatusMap[event.type];
    if (!status) {
      return null;
    }

    const payload = event.payload as {
      orderId?: unknown;
      reasonCode?: unknown;
      cancelledBy?: unknown;
    };
    if (typeof payload.orderId !== "string") {
      return null;
    }

    const details: Record<string, unknown> = {};
    if (typeof payload.reasonCode === "string") {
      details.reasonCode = payload.reasonCode;
    }
    if (typeof payload.cancelledBy === "string") {
      details.cancelledBy = payload.cancelledBy;
    }

    return {
      orderId: payload.orderId,
      eventType: event.type,
      status,
      occurredAt: event.occurredAt,
      details,
    };
  }
}
