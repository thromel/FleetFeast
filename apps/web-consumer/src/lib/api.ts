export interface ConsumerOrderView {
  id: string;
  status: string;
  timelineVersion: number;
}

export interface ConsumerQuickCreateOrderItemModifierInput {
  name: string;
  priceCents: number;
}

export interface ConsumerQuickCreateOrderItemInput {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifiers?: ConsumerQuickCreateOrderItemModifierInput[];
}

export interface ConsumerQuickCreateOrderInput {
  consumerId: string;
  merchantId: string;
  currency: string;
  item: ConsumerQuickCreateOrderItemInput;
}

export interface ConsumerApiOptions {
  consumerBffBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function createConsumerQuickOrder(
  input: ConsumerQuickCreateOrderInput,
  options?: ConsumerApiOptions,
): Promise<ConsumerOrderView> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveConsumerBffBaseUrl(options);
  const response = await fetchImpl(`${baseUrl}/app/v1/consumer/orders/quick-create`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      consumerId: input.consumerId,
      merchantId: input.merchantId,
      currency: input.currency,
      item: {
        itemId: input.item.itemId,
        name: input.item.name,
        quantity: input.item.quantity,
        unitPriceCents: input.item.unitPriceCents,
        modifiers: input.item.modifiers ?? [],
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("CONSUMER_BFF_QUICK_CREATE_ORDER_FAILED");
  }

  const payload = (await response.json()) as { order?: ConsumerOrderView };
  if (!payload.order) {
    throw new Error("CONSUMER_BFF_QUICK_CREATE_ORDER_INVALID_PAYLOAD");
  }

  return payload.order;
}

export async function fetchConsumerOrder(
  orderId: string,
  options?: ConsumerApiOptions,
): Promise<ConsumerOrderView> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveConsumerBffBaseUrl(options);
  const response = await fetchImpl(
    `${baseUrl}/app/v1/consumer/orders/${encodeURIComponent(orderId)}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("CONSUMER_BFF_ORDER_FETCH_FAILED");
  }

  const payload = (await response.json()) as { order?: ConsumerOrderView };
  if (!payload.order) {
    throw new Error("CONSUMER_BFF_ORDER_INVALID_PAYLOAD");
  }

  return payload.order;
}

function resolveConsumerBffBaseUrl(options?: ConsumerApiOptions): string {
  const candidate =
    options?.consumerBffBaseUrl ??
    process.env.CONSUMER_BFF_BASE_URL ??
    "http://127.0.0.1:4101";

  return candidate.replace(/\/+$/, "");
}
