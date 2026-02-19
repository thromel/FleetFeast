export interface MerchantOrderView {
  id: string;
  status: string;
}

export interface MerchantApiOptions {
  opsBffBaseUrl?: string;
  appSessionToken?: string;
  fetchImpl?: typeof fetch;
}

export interface MerchantSessionExchangeRequest {
  oidcToken: string;
  traceId: string;
  deviceId?: string;
}

function resolveOpsBffBaseUrl(options?: MerchantApiOptions): string {
  const candidate =
    options?.opsBffBaseUrl ??
    process.env.OPS_BFF_BASE_URL ??
    "http://127.0.0.1:4103";

  return candidate.replace(/\/+$/, "");
}

export async function fetchMerchantOrders(
  merchantId: string,
  options?: MerchantApiOptions,
): Promise<MerchantOrderView[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveOpsBffBaseUrl(options);
  const headers = options?.appSessionToken
    ? { authorization: `Bearer ${options.appSessionToken}` }
    : undefined;
  const response = await fetchImpl(
    `${baseUrl}/app/v1/merchant/orders?merchantId=${encodeURIComponent(merchantId)}`,
    {
      cache: "no-store",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error("OPS_BFF_MERCHANT_ORDERS_FETCH_FAILED");
  }

  const payload = (await response.json()) as {
    orders?: Array<{ id: string; status: string }>;
  };

  return (payload.orders ?? []).map((order) => ({
    id: order.id,
    status: order.status,
  }));
}

export async function exchangeMerchantSession(
  request: MerchantSessionExchangeRequest,
  options?: MerchantApiOptions,
): Promise<string> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveOpsBffBaseUrl(options);
  const response = await fetchImpl(`${baseUrl}/app/v1/merchant/session/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("OPS_BFF_MERCHANT_SESSION_EXCHANGE_FAILED");
  }

  const payload = (await response.json()) as {
    tokenPair?: { accessToken?: unknown };
  };
  const accessToken = payload.tokenPair?.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("OPS_BFF_MERCHANT_SESSION_EXCHANGE_INVALID_PAYLOAD");
  }

  return accessToken;
}
