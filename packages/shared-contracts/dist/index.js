export function createAppSession(input) {
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
export function isRealtimeEnvelope(candidate) {
    if (typeof candidate !== "object" || candidate === null) {
        return false;
    }
    const value = candidate;
    const occurredAt = value.occurredAt;
    return (typeof value.eventType === "string" &&
        value.eventType.length > 0 &&
        typeof value.entityId === "string" &&
        value.entityId.length > 0 &&
        typeof occurredAt === "string" &&
        !Number.isNaN(new Date(occurredAt).getTime()) &&
        typeof value.traceId === "string" &&
        value.traceId.length > 0 &&
        typeof value.payload === "object" &&
        value.payload !== null &&
        !Array.isArray(value.payload));
}
//# sourceMappingURL=index.js.map