import type { DomainEvent } from "../../modules/identity/types.js";

export interface RealtimeEnvelope {
  eventType: string;
  entityId: string;
  occurredAt: string;
  traceId: string;
  payload: Record<string, unknown>;
}

export interface RealtimeEventPublisher {
  publish(channel: string, envelope: RealtimeEnvelope): Promise<void>;
}

export interface RealtimePublication {
  channel: string;
  envelope: RealtimeEnvelope;
}

export interface HttpRealtimeEventPublisherOptions {
  baseUrl: string;
  publishApiKey?: string;
  fetchImpl?: typeof fetch;
}

const RELAY_EVENT_PREFIXES = ["order.", "dispatch.assignment."] as const;

export class HttpRealtimeEventPublisher implements RealtimeEventPublisher {
  private readonly publishEndpoint: string;
  private readonly publishApiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpRealtimeEventPublisherOptions) {
    if (options.baseUrl.trim().length === 0) {
      throw new Error("REALTIME_GATEWAY_BASE_URL_REQUIRED");
    }

    this.publishEndpoint = `${options.baseUrl.replace(/\/+$/, "")}/app/v1/realtime/publish`;
    this.publishApiKey = options.publishApiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async publish(channel: string, envelope: RealtimeEnvelope): Promise<void> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.publishApiKey) {
      headers["x-realtime-publish-key"] = this.publishApiKey;
    }

    const response = await this.fetchImpl(this.publishEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel,
        envelope,
      }),
    });

    if (!response.ok) {
      throw new Error(`REALTIME_PUBLISH_FAILED_${response.status}`);
    }
  }
}

export function mapDomainEventToRealtimePublications(
  event: DomainEvent,
): RealtimePublication[] {
  if (!RELAY_EVENT_PREFIXES.some((prefix) => event.type.startsWith(prefix))) {
    return [];
  }

  const payload = toRecord(event.payload);
  const orderId = toNonEmptyString(payload.orderId);
  if (!orderId) {
    return [];
  }

  const traceId = toNonEmptyString(payload.traceId) ?? `core-api-${event.type}-${orderId}`;
  const envelope: RealtimeEnvelope = {
    eventType: event.type,
    entityId: orderId,
    occurredAt: event.occurredAt,
    traceId,
    payload,
  };

  const channels = new Set<string>([
    `consumer.order.${orderId}`,
    `merchant.order.${orderId}`,
  ]);

  const courierId = toNonEmptyString(payload.courierId);
  if (courierId) {
    channels.add(`courier.job.${orderId}`);
  }

  return [...channels].map((channel) => ({
    channel,
    envelope,
  }));
}

export function createRealtimeEventRelaySubscriber(
  publisher: RealtimeEventPublisher,
): (event: DomainEvent) => Promise<void> {
  return async (event: DomainEvent) => {
    const publications = mapDomainEventToRealtimePublications(event);
    for (const publication of publications) {
      await publisher.publish(publication.channel, publication.envelope);
    }
  };
}

function toRecord(candidate: unknown): Record<string, unknown> {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return {};
  }

  return { ...(candidate as Record<string, unknown>) };
}

function toNonEmptyString(candidate: unknown): string | undefined {
  if (typeof candidate !== "string") {
    return undefined;
  }

  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : undefined;
}
