import Fastify, { type FastifyInstance } from "fastify";

import {
  createAppSessionAuthServiceFromEnv,
  createOidcVerifierFromEnv,
  extractRolesFromClaims,
  mapAppAuthError,
  type AppSessionAuthService,
  type OidcVerifier,
} from "@fleetfeast/app-auth";

export interface ConsumerOrderView {
  id: string;
  status: string;
  timelineVersion: number;
}

export interface ConsumerQuickOrderModifierInput {
  name: string;
  priceCents: number;
}

export interface ConsumerQuickOrderItemInput {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifiers: ConsumerQuickOrderModifierInput[];
}

export interface ConsumerQuickCreateOrderInput {
  consumerId: string;
  merchantId: string;
  currency: string;
  item: ConsumerQuickOrderItemInput;
}

export interface ConsumerFeatureFlagContext {
  userId: string;
  role: string;
  tenantId?: string;
}

export interface ConsumerFeatureFlagSnapshot {
  flags: Record<string, boolean>;
  ttlSeconds: number;
  generatedAtEpochMillis: number;
}

export interface ConsumerBffDependencies {
  getOrderById(orderId: string): Promise<ConsumerOrderView>;
  quickCreateOrder(input: ConsumerQuickCreateOrderInput): Promise<ConsumerOrderView>;
  getFeatureFlagSnapshot(context: ConsumerFeatureFlagContext): Promise<ConsumerFeatureFlagSnapshot>;
  oidcVerifier: OidcVerifier;
  sessionAuth: AppSessionAuthService;
}

export interface ConsumerCoreApiDependencyOptions {
  coreApiBaseUrl: string;
  fetchImpl?: typeof fetch;
}

export function createConsumerCoreApiDependencies(
  options: ConsumerCoreApiDependencyOptions,
): Pick<ConsumerBffDependencies, "getOrderById" | "quickCreateOrder" | "getFeatureFlagSnapshot"> {
  const baseUrl = options.coreApiBaseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const configuredFlags = parseConsumerFeatureFlags(process.env.CONSUMER_FEATURE_FLAGS_JSON);
  const ttlSeconds = parseFeatureFlagsTtlSeconds(process.env.CONSUMER_FEATURE_FLAGS_TTL_SECONDS);

  return {
    async getOrderById(orderId: string): Promise<ConsumerOrderView> {
      const response = await fetchImpl(
        `${baseUrl}/api/v1/consumer/orders/${encodeURIComponent(orderId)}`,
      );
      if (!response.ok) {
        throw new Error("CORE_API_CONSUMER_ORDER_FETCH_FAILED");
      }

      const payload = (await response.json()) as {
        id: string;
        status: string;
        timelineVersion?: number;
      };

      return {
        id: payload.id,
        status: payload.status,
        timelineVersion: typeof payload.timelineVersion === "number" ? payload.timelineVersion : 0,
      };
    },
    async quickCreateOrder(input: ConsumerQuickCreateOrderInput): Promise<ConsumerOrderView> {
      const createBasket = await fetchImpl(`${baseUrl}/api/v1/consumer/baskets`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          consumerId: input.consumerId,
          merchantId: input.merchantId,
          currency: input.currency,
        }),
      });
      if (!createBasket.ok) {
        throw new Error("CORE_API_CONSUMER_BASKET_CREATE_FAILED");
      }
      const basketPayload = (await createBasket.json()) as { id: string };

      const updateBasket = await fetchImpl(
        `${baseUrl}/api/v1/consumer/baskets/${encodeURIComponent(basketPayload.id)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            items: [
              {
                itemId: input.item.itemId,
                name: input.item.name,
                quantity: input.item.quantity,
                unitPriceCents:
                  input.item.unitPriceCents +
                  input.item.modifiers.reduce((sum, modifier) => sum + modifier.priceCents, 0),
                modifiers: input.item.modifiers
                  .map((modifier) => modifier.name.trim())
                  .filter((name) => name.length > 0),
              },
            ],
          }),
        },
      );
      if (!updateBasket.ok) {
        throw new Error("CORE_API_CONSUMER_BASKET_UPDATE_FAILED");
      }

      const createQuote = await fetchImpl(`${baseUrl}/api/v1/consumer/quotes`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          basketId: basketPayload.id,
        }),
      });
      if (!createQuote.ok) {
        throw new Error("CORE_API_CONSUMER_QUOTE_CREATE_FAILED");
      }
      const quotePayload = (await createQuote.json()) as {
        quoteId: string;
        quoteHash: string;
        basketId: string;
      };

      const createCheckout = await fetchImpl(`${baseUrl}/api/v1/consumer/checkout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          basketId: quotePayload.basketId,
          quoteId: quotePayload.quoteId,
          quoteHash: quotePayload.quoteHash,
        }),
      });
      if (!createCheckout.ok) {
        throw new Error("CORE_API_CONSUMER_CHECKOUT_CREATE_FAILED");
      }
      const checkoutPayload = (await createCheckout.json()) as {
        checkoutId: string;
        quoteHash: string;
      };

      const createOrder = await fetchImpl(`${baseUrl}/api/v1/consumer/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          checkoutId: checkoutPayload.checkoutId,
          quoteHash: checkoutPayload.quoteHash,
        }),
      });
      if (!createOrder.ok) {
        throw new Error("CORE_API_CONSUMER_ORDER_CREATE_FAILED");
      }
      const orderPayload = (await createOrder.json()) as {
        id: string;
        status: string;
        timelineVersion?: number;
      };

      return {
        id: orderPayload.id,
        status: orderPayload.status,
        timelineVersion:
          typeof orderPayload.timelineVersion === "number" ? orderPayload.timelineVersion : 0,
      };
    },
    async getFeatureFlagSnapshot(): Promise<ConsumerFeatureFlagSnapshot> {
      return {
        flags: configuredFlags,
        ttlSeconds,
        generatedAtEpochMillis: Date.now(),
      };
    },
  };
}

export function createConsumerBffServer(
  dependencies: ConsumerBffDependencies,
): FastifyInstance {
  const app = Fastify();

  app.post("/app/v1/consumer/session/exchange", async (request, reply) => {
    const payload = request.body as {
      oidcToken?: unknown;
      traceId?: unknown;
      deviceId?: unknown;
    };

    if (
      typeof payload?.oidcToken !== "string" ||
      payload.oidcToken.trim().length === 0 ||
      typeof payload?.traceId !== "string" ||
      payload.traceId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_SESSION_EXCHANGE_PAYLOAD",
        message: "oidcToken and traceId are required",
      };
    }

    if (payload.deviceId !== undefined && typeof payload.deviceId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_DEVICE_ID",
        message: "deviceId must be a string when provided",
      };
    }

    try {
      const identity = await dependencies.oidcVerifier.verifyIdToken(payload.oidcToken);
      const roles = extractRolesFromClaims(identity.claims);
      if (roles.length > 0 && !roles.includes("consumer")) {
        reply.status(403);
        return {
          errorCode: "CONSUMER_ROLE_REQUIRED",
          message: "OIDC identity does not include consumer role",
        };
      }

      const sessionBundle = await dependencies.sessionAuth.issueSession({
        userId: identity.subject,
        role: "consumer",
        persona: "consumer",
        traceId: payload.traceId,
        deviceId: payload.deviceId,
      });

      return sessionBundle;
    } catch (error: unknown) {
      const mapped = mapAppAuthError(error);
      if (mapped) {
        reply.status(mapped.statusCode);
        return {
          errorCode: mapped.errorCode,
          message: mapped.message,
        };
      }

      throw error;
    }
  });

  app.post("/app/v1/consumer/session/refresh", async (request, reply) => {
    const payload = request.body as {
      refreshToken?: unknown;
      traceId?: unknown;
      deviceId?: unknown;
    };

    if (
      typeof payload?.refreshToken !== "string" ||
      payload.refreshToken.trim().length === 0 ||
      typeof payload?.traceId !== "string" ||
      payload.traceId.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_SESSION_REFRESH_PAYLOAD",
        message: "refreshToken and traceId are required",
      };
    }

    if (payload.deviceId !== undefined && typeof payload.deviceId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_APP_DEVICE_ID",
        message: "deviceId must be a string when provided",
      };
    }

    try {
      const sessionBundle = await dependencies.sessionAuth.refreshSession({
        refreshToken: payload.refreshToken,
        traceId: payload.traceId,
        deviceId: payload.deviceId,
      });
      return sessionBundle;
    } catch (error: unknown) {
      const mapped = mapAppAuthError(error);
      if (mapped) {
        reply.status(mapped.statusCode);
        return {
          errorCode: mapped.errorCode,
          message: mapped.message,
        };
      }

      throw error;
    }
  });

  app.get("/app/v1/consumer/orders/:orderId", async (request, reply) => {
    const params = request.params as { orderId?: unknown };
    if (typeof params?.orderId !== "string" || params.orderId.trim().length === 0) {
      reply.status(400);
      return {
        errorCode: "INVALID_CONSUMER_ORDER_ROUTE_PARAM",
        message: "orderId is required",
      };
    }

    const order = await dependencies.getOrderById(params.orderId);
    return { order };
  });

  app.post("/app/v1/consumer/orders/quick-create", async (request, reply) => {
    const payload = request.body as {
      consumerId?: unknown;
      merchantId?: unknown;
      currency?: unknown;
      item?: unknown;
    };

    if (
      typeof payload?.consumerId !== "string" ||
      payload.consumerId.trim().length === 0 ||
      typeof payload?.merchantId !== "string" ||
      payload.merchantId.trim().length === 0 ||
      typeof payload?.currency !== "string" ||
      payload.currency.trim().length === 0 ||
      typeof payload?.item !== "object" ||
      payload.item === null
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_CONSUMER_QUICK_CREATE_PAYLOAD",
        message: "consumerId, merchantId, currency, and item are required",
      };
    }

    const item = payload.item as {
      itemId?: unknown;
      name?: unknown;
      quantity?: unknown;
      unitPriceCents?: unknown;
      modifiers?: unknown;
    };

    if (
      typeof item.itemId !== "string" ||
      item.itemId.trim().length === 0 ||
      typeof item.name !== "string" ||
      item.name.trim().length === 0 ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      typeof item.unitPriceCents !== "number" ||
      !Number.isInteger(item.unitPriceCents) ||
      item.unitPriceCents < 0 ||
      !Array.isArray(item.modifiers)
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_CONSUMER_QUICK_CREATE_ITEM",
        message: "item payload is invalid",
      };
    }

    const modifiers: ConsumerQuickOrderModifierInput[] = [];
    for (const modifier of item.modifiers) {
      if (
        typeof modifier !== "object" ||
        modifier === null ||
        typeof (modifier as { name?: unknown }).name !== "string" ||
        (modifier as { name: string }).name.trim().length === 0 ||
        typeof (modifier as { priceCents?: unknown }).priceCents !== "number" ||
        !Number.isInteger((modifier as { priceCents: number }).priceCents)
      ) {
        reply.status(400);
        return {
          errorCode: "INVALID_CONSUMER_QUICK_CREATE_ITEM",
          message: "item modifiers payload is invalid",
        };
      }

      modifiers.push({
        name: (modifier as { name: string }).name,
        priceCents: (modifier as { priceCents: number }).priceCents,
      });
    }

    const order = await dependencies.quickCreateOrder({
      consumerId: payload.consumerId,
      merchantId: payload.merchantId,
      currency: payload.currency,
      item: {
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        modifiers,
      },
    });

    reply.status(201);
    return { order };
  });

  app.get("/app/v1/consumer/feature-flags", async (request, reply) => {
    const query = request.query as { userId?: unknown; role?: unknown; tenantId?: unknown };
    if (
      typeof query?.userId !== "string" ||
      query.userId.trim().length === 0 ||
      typeof query?.role !== "string" ||
      query.role.trim().length === 0
    ) {
      reply.status(400);
      return {
        errorCode: "INVALID_FEATURE_FLAG_QUERY",
        message: "userId and role query params are required",
      };
    }

    if (query.tenantId !== undefined && typeof query.tenantId !== "string") {
      reply.status(400);
      return {
        errorCode: "INVALID_FEATURE_FLAG_QUERY",
        message: "tenantId must be a string when provided",
      };
    }

    return dependencies.getFeatureFlagSnapshot({
      userId: query.userId,
      role: query.role,
      tenantId: query.tenantId,
    });
  });

  return app;
}

export function createConsumerBffServerFromEnv(): FastifyInstance {
  return createConsumerBffServer({
    ...createConsumerCoreApiDependencies({
      coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "http://127.0.0.1:3000",
    }),
    oidcVerifier: createOidcVerifierFromEnv(process.env),
    sessionAuth: createAppSessionAuthServiceFromEnv(process.env),
  });
}

const DEFAULT_CONSUMER_FEATURE_FLAGS: Record<string, boolean> = {
  "consumer.timelineV2": false,
};

function parseConsumerFeatureFlags(rawFlags: string | undefined): Record<string, boolean> {
  if (!rawFlags) {
    return { ...DEFAULT_CONSUMER_FEATURE_FLAGS };
  }

  try {
    const parsed = JSON.parse(rawFlags) as Record<string, unknown>;
    const flags: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        flags[key] = value;
      }
    }

    return Object.keys(flags).length > 0 ? flags : { ...DEFAULT_CONSUMER_FEATURE_FLAGS };
  } catch {
    return { ...DEFAULT_CONSUMER_FEATURE_FLAGS };
  }
}

function parseFeatureFlagsTtlSeconds(rawTtlSeconds: string | undefined): number {
  const parsed = Number.parseInt(rawTtlSeconds ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }

  return parsed;
}
