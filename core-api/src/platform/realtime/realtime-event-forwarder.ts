import { randomUUID } from "node:crypto";

import type { DomainEvent } from "../../modules/identity/types.js";

export interface RealtimeEventForwarder {
  forward(event: DomainEvent): Promise<void>;
}

interface RealtimeTarget {
  channel: string;
  entityId: string;
}

const CONSUMER_ORDER_EVENT_TYPES = new Set([
  "order.created.v1",
  "order.confirmed.v1",
  "order.cancelled.v1",
  "order.cancel_requested.v1",
  "order.picked_up.v1",
  "order.delivered.v1",
]);

const COURIER_JOB_EVENT_TYPES = new Set([
  "dispatch.assignment.requested.v1",
  "dispatch.assignment.completed.v1",
]);

export function resolveRealtimeTarget(event: DomainEvent): RealtimeTarget | null {
  const payload = event.payload as Record<string, unknown>;
  const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
  if (!orderId) {
    return null;
  }

  if (CONSUMER_ORDER_EVENT_TYPES.has(event.type)) {
    return { channel: `consumer.order.${orderId}`, entityId: orderId };
  }

  if (COURIER_JOB_EVENT_TYPES.has(event.type)) {
    return { channel: `courier.job.${orderId}`, entityId: orderId };
  }

  return null;
}

export interface HttpRealtimeEventForwarderOptions {
  realtimeGatewayBaseUrl: string;
  publishApiKey?: string;
  fetchImpl?: typeof fetch;
}

export class HttpRealtimeEventForwarder implements RealtimeEventForwarder {
  private readonly baseUrl: string;
  private readonly publishApiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpRealtimeEventForwarderOptions) {
    this.baseUrl = options.realtimeGatewayBaseUrl.replace(/\/+$/, "");
    this.publishApiKey = options.publishApiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async forward(event: DomainEvent): Promise<void> {
    const target = resolveRealtimeTarget(event);
    if (!target) {
      return;
    }

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.publishApiKey) {
      headers["x-realtime-publish-key"] = this.publishApiKey;
    }

    await this.fetchImpl(`${this.baseUrl}/app/v1/realtime/publish`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel: target.channel,
        envelope: {
          eventType: event.type,
          entityId: target.entityId,
          occurredAt: event.occurredAt,
          traceId: randomUUID(),
          payload: event.payload,
        },
      }),
    });
  }
}
