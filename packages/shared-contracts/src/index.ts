export type AppPersona = "consumer" | "courier" | "merchant" | "admin";

export type AppRole =
  | "consumer"
  | "courier"
  | "merchant_operator"
  | "support_agent"
  | "finance_ops"
  | "system_admin";

export interface AppSession {
  sessionId: string;
  userId: string;
  role: AppRole;
  persona: AppPersona;
  traceId: string;
  refreshTokenId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AppSessionExchangeRequest {
  oidcToken: string;
  traceId: string;
  deviceId?: string;
}

export interface AppSessionRefreshRequest {
  refreshToken: string;
  traceId: string;
  deviceId?: string;
}

export interface AppSessionTokenPair {
  tokenType: "Bearer";
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
  refreshExpiresAt: string;
}

export interface AppSessionExchangeResponse {
  session: AppSession;
  tokenPair: AppSessionTokenPair;
}

export interface CreateAppSessionInput {
  sessionId: string;
  userId: string;
  role: AppRole;
  persona: AppPersona;
  traceId: string;
  refreshTokenId: string;
  expiresInSeconds: number;
}

export interface RealtimeEnvelope {
  eventType: string;
  entityId: string;
  occurredAt: string;
  traceId: string;
  payload: Record<string, unknown>;
}

export function createAppSession(input: CreateAppSessionInput): AppSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString();

  return {
    sessionId: input.sessionId,
    userId: input.userId,
    role: input.role,
    persona: input.persona,
    traceId: input.traceId,
    refreshTokenId: input.refreshTokenId,
    issuedAt: now.toISOString(),
    expiresAt,
  };
}

export function isRealtimeEnvelope(candidate: unknown): candidate is RealtimeEnvelope {
  if (typeof candidate !== "object" || candidate === null) {
    return false;
  }

  const value = candidate as Record<string, unknown>;
  const occurredAt = value.occurredAt;

  return (
    typeof value.eventType === "string" &&
    value.eventType.length > 0 &&
    typeof value.entityId === "string" &&
    value.entityId.length > 0 &&
    typeof occurredAt === "string" &&
    !Number.isNaN(new Date(occurredAt).getTime()) &&
    typeof value.traceId === "string" &&
    value.traceId.length > 0 &&
    typeof value.payload === "object" &&
    value.payload !== null &&
    !Array.isArray(value.payload)
  );
}
