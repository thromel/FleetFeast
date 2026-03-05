const DEFAULT_DEMO_SURFACE_URLS = {
    consumer: "http://127.0.0.1:3003",
    merchant: "http://127.0.0.1:3001",
    courier: "http://127.0.0.1:3004",
    admin: "http://127.0.0.1:3002",
};
const DEMO_SURFACE_DESCRIPTIONS = {
    consumer: {
        label: "Consumer",
        description: "Create the order and follow the promise window.",
    },
    merchant: {
        label: "Merchant",
        description: "Accept the ticket and release it for dispatch.",
    },
    courier: {
        label: "Courier",
        description: "Accept, pick up, and complete fulfillment.",
    },
    admin: {
        label: "Admin",
        description: "Show SLOs, incidents, and operating controls.",
    },
};
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
export function buildDemoSurfaceLinks(current, overrides = {}) {
    return Object.keys(DEFAULT_DEMO_SURFACE_URLS).map((id) => ({
        id,
        label: DEMO_SURFACE_DESCRIPTIONS[id].label,
        href: overrides[id] ?? DEFAULT_DEMO_SURFACE_URLS[id],
        description: DEMO_SURFACE_DESCRIPTIONS[id].description,
        isCurrent: id === current,
    }));
}
export function describeOrderStage(status) {
    switch (status) {
        case "CREATED":
            return {
                label: "Awaiting Merchant",
                persona: "merchant",
                tone: "attention",
            };
        case "MERCHANT_ACCEPTED":
        case "DISPATCH_PENDING":
        case "DISPATCH_REQUESTED":
            return {
                label: "Dispatching",
                persona: "merchant",
                tone: "active",
            };
        case "COURIER_ASSIGNED":
        case "PICKED_UP":
            return {
                label: "Courier En Route",
                persona: "courier",
                tone: "active",
            };
        case "DELIVERED":
            return {
                label: "Completed",
                persona: "consumer",
                tone: "complete",
            };
        default:
            return {
                label: "Drafting Order",
                persona: "consumer",
                tone: "attention",
            };
    }
}
//# sourceMappingURL=index.js.map