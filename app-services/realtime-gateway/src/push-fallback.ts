import type { RealtimeEnvelope } from "@fleetfeast/shared-contracts";

export type PushProvider = "apns" | "fcm";

export interface PushFallbackTarget {
  channel: string;
  userId: string;
  pushToken: string;
  provider: PushProvider;
}

export interface PushFallbackMessage {
  channel: string;
  envelope: RealtimeEnvelope;
  target: PushFallbackTarget;
  reason: "NO_ACTIVE_SOCKET";
}

export interface PushFallbackNotifier {
  send(message: PushFallbackMessage): Promise<void>;
}

export interface PushProviderSender {
  provider: PushProvider;
  send(message: PushFallbackMessage): Promise<void>;
}

export interface PushProviderHttpAdapterOptions {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface HttpClientRequest {
  endpoint: string;
  authToken?: string;
  timeoutMs: number;
  payload: unknown;
  fetchImpl: typeof fetch;
}

export function createNoopPushProviderSender(provider: PushProvider): PushProviderSender {
  return {
    provider,
    async send(_message: PushFallbackMessage): Promise<void> {
      return;
    },
  };
}

export function createApnsPushProviderSender(
  options: PushProviderHttpAdapterOptions,
): PushProviderSender {
  const endpoint = options.endpoint.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;

  return {
    provider: "apns",
    async send(message: PushFallbackMessage): Promise<void> {
      if (message.target.provider !== "apns") {
        return;
      }

      const apnsPayload = {
        token: message.target.pushToken,
        aps: {
          alert: {
            title: "FleetFeast delivery update",
            body: `${message.envelope.eventType} (${message.envelope.entityId})`,
          },
          sound: "default",
          "content-available": 1,
        },
        data: {
          channel: message.channel,
          reason: message.reason,
          traceId: message.envelope.traceId,
          eventType: message.envelope.eventType,
          entityId: message.envelope.entityId,
          occurredAt: message.envelope.occurredAt,
        },
      };

      await postJson({
        endpoint,
        authToken: options.authToken,
        timeoutMs,
        payload: apnsPayload,
        fetchImpl,
      });
    },
  };
}

export function createFcmPushProviderSender(
  options: PushProviderHttpAdapterOptions,
): PushProviderSender {
  const endpoint = options.endpoint.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;

  return {
    provider: "fcm",
    async send(message: PushFallbackMessage): Promise<void> {
      if (message.target.provider !== "fcm") {
        return;
      }

      const fcmPayload = {
        token: message.target.pushToken,
        notification: {
          title: "FleetFeast delivery update",
          body: `${message.envelope.eventType} (${message.envelope.entityId})`,
        },
        data: {
          channel: message.channel,
          reason: message.reason,
          traceId: message.envelope.traceId,
          eventType: message.envelope.eventType,
          entityId: message.envelope.entityId,
          occurredAt: message.envelope.occurredAt,
        },
      };

      await postJson({
        endpoint,
        authToken: options.authToken,
        timeoutMs,
        payload: fcmPayload,
        fetchImpl,
      });
    },
  };
}

export function createRoutingPushFallbackNotifier(
  senders: PushProviderSender[],
): PushFallbackNotifier {
  const byProvider = new Map<PushProvider, PushProviderSender>();
  for (const sender of senders) {
    byProvider.set(sender.provider, sender);
  }

  return {
    async send(message: PushFallbackMessage): Promise<void> {
      const sender = byProvider.get(message.target.provider);
      if (!sender) {
        throw new Error(`PUSH_PROVIDER_NOT_CONFIGURED:${message.target.provider}`);
      }

      await sender.send(message);
    },
  };
}

export interface PushFallbackNotifierFromEnvOptions {
  fetchImpl?: typeof fetch;
}

export function createPushFallbackNotifierFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: PushFallbackNotifierFromEnvOptions = {},
): PushFallbackNotifier {
  const timeoutMs = parseTimeoutMs(env.PUSH_HTTP_TIMEOUT_MS);

  const apnsSender = env.APNS_PUSH_ENDPOINT
    ? createApnsPushProviderSender({
        endpoint: env.APNS_PUSH_ENDPOINT,
        authToken: env.APNS_PUSH_AUTH_TOKEN,
        timeoutMs,
        fetchImpl: options.fetchImpl,
      })
    : createNoopPushProviderSender("apns");

  const fcmSender = env.FCM_PUSH_ENDPOINT
    ? createFcmPushProviderSender({
        endpoint: env.FCM_PUSH_ENDPOINT,
        authToken: env.FCM_PUSH_AUTH_TOKEN,
        timeoutMs,
        fetchImpl: options.fetchImpl,
      })
    : createNoopPushProviderSender("fcm");

  return createRoutingPushFallbackNotifier([apnsSender, fcmSender]);
}

async function postJson(request: HttpClientRequest): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, request.timeoutMs);

  try {
    const response = await request.fetchImpl(request.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(request.authToken
          ? {
              authorization: `Bearer ${request.authToken}`,
            }
          : {}),
      },
      body: JSON.stringify(request.payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`PUSH_PROVIDER_HTTP_ERROR:${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function parseTimeoutMs(rawValue: string | undefined): number {
  if (!rawValue) {
    return 5000;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5000;
  }

  return parsed;
}
