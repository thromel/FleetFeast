export type AppPersona = "consumer" | "courier" | "merchant" | "admin";
export type AppRole = "consumer" | "courier" | "merchant_operator" | "support_agent" | "finance_ops" | "system_admin";
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
export interface DemoSurfaceLink {
    id: AppPersona;
    label: string;
    href: string;
    description: string;
    isCurrent: boolean;
}
export interface OrderStageDescriptor {
    label: string;
    persona: AppPersona;
    tone: "attention" | "active" | "complete";
}
export declare function createAppSession(input: CreateAppSessionInput): AppSession;
export declare function isRealtimeEnvelope(candidate: unknown): candidate is RealtimeEnvelope;
export declare function buildDemoSurfaceLinks(current: AppPersona, overrides?: Partial<Record<AppPersona, string>>): DemoSurfaceLink[];
export declare function describeOrderStage(status: string | null | undefined): OrderStageDescriptor;
