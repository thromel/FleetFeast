export interface AdminIncidentView {
  id: string;
  severity: string;
}

export interface AdminFeatureFlagContext {
  userId: string;
  role: string;
  tenantId?: string;
}

export interface AdminFeatureFlagSnapshot {
  flags: Record<string, boolean>;
  ttlSeconds: number;
  generatedAtEpochMillis: number;
}

export interface AdminApiOptions {
  opsBffBaseUrl?: string;
  appSessionToken?: string;
  fetchImpl?: typeof fetch;
}

export interface AdminAppSession {
  sessionId: string;
  userId: string;
  role: string;
  persona: string;
  traceId: string;
  refreshTokenId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AdminSessionTokenPair {
  tokenType: "Bearer";
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
  refreshExpiresAt: string;
}

export interface AdminSessionExchangeResponse {
  session: AdminAppSession;
  tokenPair: AdminSessionTokenPair;
}

export interface AdminSessionExchangeRequest {
  oidcToken: string;
  traceId: string;
  deviceId?: string;
}

export interface AdminSessionRefreshRequest {
  refreshToken: string;
  traceId: string;
  deviceId?: string;
}

function resolveOpsBffBaseUrl(options?: AdminApiOptions): string {
  const candidate =
    options?.opsBffBaseUrl ??
    process.env.OPS_BFF_BASE_URL ??
    "http://127.0.0.1:4103";

  return candidate.replace(/\/+$/, "");
}

export async function fetchAdminIncidents(
  options?: AdminApiOptions,
): Promise<AdminIncidentView[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveOpsBffBaseUrl(options);
  const headers = options?.appSessionToken
    ? { authorization: `Bearer ${options.appSessionToken}` }
    : undefined;
  const response = await fetchImpl(`${baseUrl}/app/v1/admin/incidents`, {
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    throw new Error("OPS_BFF_ADMIN_INCIDENTS_FETCH_FAILED");
  }

  const payload = (await response.json()) as {
    incidents?: Array<{ id: string; severity: string }>;
  };

  return (payload.incidents ?? []).map((incident) => ({
    id: incident.id,
    severity: incident.severity,
  }));
}

export async function fetchAdminFeatureFlags(
  context: AdminFeatureFlagContext,
  options?: AdminApiOptions,
): Promise<AdminFeatureFlagSnapshot> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveOpsBffBaseUrl(options);
  const query = new URLSearchParams({
    userId: context.userId,
    role: context.role,
  });
  if (context.tenantId) {
    query.set("tenantId", context.tenantId);
  }

  const headers = options?.appSessionToken
    ? { authorization: `Bearer ${options.appSessionToken}` }
    : undefined;
  const response = await fetchImpl(`${baseUrl}/app/v1/admin/feature-flags?${query.toString()}`, {
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    throw new Error("OPS_BFF_ADMIN_FEATURE_FLAGS_FETCH_FAILED");
  }

  return parseAdminFeatureFlagSnapshot(
    await response.json(),
    "OPS_BFF_ADMIN_FEATURE_FLAGS_INVALID_PAYLOAD",
  );
}

export async function exchangeAdminSession(
  request: AdminSessionExchangeRequest,
  options?: AdminApiOptions,
): Promise<AdminSessionExchangeResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveOpsBffBaseUrl(options);
  const response = await fetchImpl(`${baseUrl}/app/v1/admin/session/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("OPS_BFF_ADMIN_SESSION_EXCHANGE_FAILED");
  }

  return parseAdminSessionExchangeResponse(
    await response.json(),
    "OPS_BFF_ADMIN_SESSION_EXCHANGE_INVALID_PAYLOAD",
  );
}

export async function refreshAdminSession(
  request: AdminSessionRefreshRequest,
  options?: AdminApiOptions,
): Promise<AdminSessionExchangeResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveOpsBffBaseUrl(options);
  const response = await fetchImpl(`${baseUrl}/app/v1/admin/session/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("OPS_BFF_ADMIN_SESSION_REFRESH_FAILED");
  }

  return parseAdminSessionExchangeResponse(
    await response.json(),
    "OPS_BFF_ADMIN_SESSION_REFRESH_INVALID_PAYLOAD",
  );
}

function parseAdminSessionExchangeResponse(
  payload: unknown,
  invalidPayloadErrorCode: string,
): AdminSessionExchangeResponse {
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

function parseAdminFeatureFlagSnapshot(
  payload: unknown,
  invalidPayloadErrorCode: string,
): AdminFeatureFlagSnapshot {
  if (typeof payload !== "object" || payload === null) {
    throw new Error(invalidPayloadErrorCode);
  }

  const response = payload as {
    flags?: unknown;
    ttlSeconds?: unknown;
    generatedAtEpochMillis?: unknown;
  };
  const flags = asBooleanFlagRecord(response.flags, invalidPayloadErrorCode);
  const ttlSeconds = asPositiveInteger(response.ttlSeconds, invalidPayloadErrorCode);
  const generatedAtEpochMillis = asPositiveInteger(
    response.generatedAtEpochMillis,
    invalidPayloadErrorCode,
  );

  return {
    flags,
    ttlSeconds,
    generatedAtEpochMillis,
  };
}

function asBooleanFlagRecord(value: unknown, errorCode: string): Record<string, boolean> {
  if (typeof value !== "object" || value === null) {
    throw new Error(errorCode);
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const flags: Record<string, boolean> = {};
  for (const [key, flagValue] of entries) {
    if (typeof flagValue !== "boolean") {
      throw new Error(errorCode);
    }

    flags[key] = flagValue;
  }

  return flags;
}
