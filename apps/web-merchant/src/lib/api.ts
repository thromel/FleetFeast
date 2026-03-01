export interface MerchantOrderView {
  id: string;
  status: string;
}

export interface MerchantApiOptions {
  opsBffBaseUrl?: string;
  appSessionToken?: string;
  fetchImpl?: typeof fetch;
}

export interface MerchantAppSession {
  sessionId: string;
  userId: string;
  role: string;
  persona: string;
  traceId: string;
  refreshTokenId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface MerchantSessionTokenPair {
  tokenType: "Bearer";
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
  refreshExpiresAt: string;
}

export interface MerchantSessionExchangeResponse {
  session: MerchantAppSession;
  tokenPair: MerchantSessionTokenPair;
}

export interface MerchantSessionExchangeRequest {
  oidcToken: string;
  traceId: string;
  deviceId?: string;
}

export interface MerchantSessionRefreshRequest {
  refreshToken: string;
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
): Promise<MerchantSessionExchangeResponse> {
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

  return parseMerchantSessionExchangeResponse(
    await response.json(),
    "OPS_BFF_MERCHANT_SESSION_EXCHANGE_INVALID_PAYLOAD",
  );
}

export async function refreshMerchantSession(
  request: MerchantSessionRefreshRequest,
  options?: MerchantApiOptions,
): Promise<MerchantSessionExchangeResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveOpsBffBaseUrl(options);
  const response = await fetchImpl(`${baseUrl}/app/v1/merchant/session/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("OPS_BFF_MERCHANT_SESSION_REFRESH_FAILED");
  }

  return parseMerchantSessionExchangeResponse(
    await response.json(),
    "OPS_BFF_MERCHANT_SESSION_REFRESH_INVALID_PAYLOAD",
  );
}

function parseMerchantSessionExchangeResponse(
  payload: unknown,
  invalidPayloadErrorCode: string,
): MerchantSessionExchangeResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error(invalidPayloadErrorCode);
  }

  const response = payload as { session?: unknown; tokenPair?: unknown };
  if (
    typeof response.session !== "object" ||
    response.session === null ||
    typeof response.tokenPair !== "object" ||
    response.tokenPair === null
  ) {
    throw new Error(invalidPayloadErrorCode);
  }

  const session = response.session as Record<string, unknown>;
  const tokenPair = response.tokenPair as Record<string, unknown>;
  const tokenType = asNonEmptyString(tokenPair.tokenType, invalidPayloadErrorCode);
  if (tokenType !== "Bearer") {
    throw new Error(invalidPayloadErrorCode);
  }

  return {
    session: {
      sessionId: asNonEmptyString(session.sessionId, invalidPayloadErrorCode),
      userId: asNonEmptyString(session.userId, invalidPayloadErrorCode),
      role: asNonEmptyString(session.role, invalidPayloadErrorCode),
      persona: asNonEmptyString(session.persona, invalidPayloadErrorCode),
      traceId: asNonEmptyString(session.traceId, invalidPayloadErrorCode),
      refreshTokenId: asNonEmptyString(session.refreshTokenId, invalidPayloadErrorCode),
      issuedAt: asNonEmptyString(session.issuedAt, invalidPayloadErrorCode),
      expiresAt: asNonEmptyString(session.expiresAt, invalidPayloadErrorCode),
    },
    tokenPair: {
      tokenType,
      accessToken: asNonEmptyString(tokenPair.accessToken, invalidPayloadErrorCode),
      refreshToken: asNonEmptyString(tokenPair.refreshToken, invalidPayloadErrorCode),
      expiresInSeconds: asPositiveInteger(tokenPair.expiresInSeconds, invalidPayloadErrorCode),
      refreshExpiresInSeconds: asPositiveInteger(
        tokenPair.refreshExpiresInSeconds,
        invalidPayloadErrorCode,
      ),
      refreshExpiresAt: asNonEmptyString(tokenPair.refreshExpiresAt, invalidPayloadErrorCode),
    },
  };
}

function asNonEmptyString(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(errorCode);
  }

  return value;
}

function asPositiveInteger(value: unknown, errorCode: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(errorCode);
  }

  return value;
}
