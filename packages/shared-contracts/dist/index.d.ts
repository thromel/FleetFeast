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
export declare function createAppSession(input: CreateAppSessionInput): AppSession;
export declare function isRealtimeEnvelope(candidate: unknown): candidate is RealtimeEnvelope;
