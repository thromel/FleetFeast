import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createAppSessionAuthService, createDevOidcVerifier } from "@fleetfeast/app-auth";
import { createConsumerBffServer, createConsumerCoreApiDependencies } from "./server.js";
function createTestConsumerDependencies(getOrderById, getFeatureFlagSnapshot = async () => ({
    flags: {
        "consumer.timelineV2": false,
    },
    ttlSeconds: 30,
    generatedAtEpochMillis: 1_735_681_200_000,
})) {
    return {
        getOrderById,
        getFeatureFlagSnapshot,
        oidcVerifier: createDevOidcVerifier(),
        sessionAuth: createAppSessionAuthService({
            jwtSecret: "fleetfeast-consumer-bff-test-secret",
        }),
    };
}
test("consumer-bff exchanges OIDC token into app session and token pair", async () => {
    const app = createConsumerBffServer(createTestConsumerDependencies(async () => ({
        id: "order-1",
        status: "DISPATCH_PENDING",
        timelineVersion: 2,
    })));
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind consumer-bff test listener");
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/consumer/session/exchange`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                oidcToken: "dev:user-1:user-1@fleetfeast.dev:consumer",
                traceId: "trace-1",
                deviceId: "device-1",
            }),
        });
        assert.equal(response.status, 200);
        const payload = (await response.json());
        assert.equal(payload.session.persona, "consumer");
        assert.equal(payload.session.role, "consumer");
        assert.equal(payload.session.userId, "user-1");
        assert.ok(payload.session.refreshTokenId.length > 0);
        assert.ok(payload.tokenPair.accessToken.length > 20);
        assert.ok(payload.tokenPair.refreshToken.length > 20);
        assert.ok(payload.tokenPair.refreshExpiresAt.length > 10);
    }
    finally {
        await app.close();
    }
});
test("consumer-bff refresh endpoint rotates refresh token and rejects replay", async () => {
    const app = createConsumerBffServer(createTestConsumerDependencies(async (orderId) => ({
        id: orderId,
        status: "COURIER_ASSIGNED",
        timelineVersion: 3,
    })));
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind consumer-bff test listener");
        }
        const exchange = await fetch(`http://127.0.0.1:${address.port}/app/v1/consumer/session/exchange`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                oidcToken: "dev:user-1:user-1@fleetfeast.dev:consumer",
                traceId: "trace-exchange",
                deviceId: "device-1",
            }),
        });
        assert.equal(exchange.status, 200);
        const exchangePayload = (await exchange.json());
        const refresh = await fetch(`http://127.0.0.1:${address.port}/app/v1/consumer/session/refresh`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                refreshToken: exchangePayload.tokenPair.refreshToken,
                traceId: "trace-refresh",
                deviceId: "device-1",
            }),
        });
        assert.equal(refresh.status, 200);
        const refreshPayload = (await refresh.json());
        assert.notEqual(refreshPayload.tokenPair.refreshToken, exchangePayload.tokenPair.refreshToken);
        const replay = await fetch(`http://127.0.0.1:${address.port}/app/v1/consumer/session/refresh`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                refreshToken: exchangePayload.tokenPair.refreshToken,
                traceId: "trace-replay",
                deviceId: "device-1",
            }),
        });
        assert.equal(replay.status, 401);
        const replayPayload = (await replay.json());
        assert.equal(replayPayload.errorCode, "APP_REFRESH_TOKEN_REPLAYED");
    }
    finally {
        await app.close();
    }
});
test("consumer-bff serves consumer order details through adapter", async () => {
    const app = createConsumerBffServer(createTestConsumerDependencies(async (orderId) => ({
        id: orderId,
        status: "COURIER_ASSIGNED",
        timelineVersion: 3,
    })));
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind consumer-bff test listener");
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/consumer/orders/order-42`);
        assert.equal(response.status, 200);
        const payload = (await response.json());
        assert.equal(payload.order.id, "order-42");
        assert.equal(payload.order.status, "COURIER_ASSIGNED");
    }
    finally {
        await app.close();
    }
});
test("consumer-bff returns feature-flag snapshot", async () => {
    const app = createConsumerBffServer(createTestConsumerDependencies(async (orderId) => ({
        id: orderId,
        status: "COURIER_ASSIGNED",
        timelineVersion: 3,
    }), async () => ({
        flags: {
            "consumer.timelineV2": true,
            "consumer.cartRecommendations": false,
        },
        ttlSeconds: 75,
        generatedAtEpochMillis: 1_735_681_201_000,
    })));
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind consumer-bff test listener");
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/consumer/feature-flags?userId=consumer-1&role=consumer&tenantId=metro-1`);
        assert.equal(response.status, 200);
        const payload = (await response.json());
        assert.equal(payload.flags["consumer.timelineV2"], true);
        assert.equal(payload.flags["consumer.cartRecommendations"], false);
        assert.equal(payload.ttlSeconds, 75);
        assert.equal(payload.generatedAtEpochMillis, 1_735_681_201_000);
    }
    finally {
        await app.close();
    }
});
test("consumer-bff core-api dependency calls backend order endpoint", async () => {
    const requests = [];
    const backend = createHttpServer((request, response) => {
        requests.push({
            method: request.method ?? "",
            url: request.url ?? "",
        });
        if (request.method === "GET" && request.url === "/api/v1/consumer/orders/order-77") {
            response.statusCode = 200;
            response.setHeader("content-type", "application/json");
            response.end(JSON.stringify({
                id: "order-77",
                status: "COURIER_ASSIGNED",
                timelineVersion: 9,
            }));
            return;
        }
        response.statusCode = 404;
        response.end();
    });
    await new Promise((resolve, reject) => {
        backend.listen(0, "127.0.0.1", (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
    const backendAddress = backend.address();
    if (!backendAddress || typeof backendAddress === "string") {
        throw new Error("Failed to bind consumer backend stub");
    }
    const app = createConsumerBffServer({
        ...createConsumerCoreApiDependencies({
            coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
        }),
        oidcVerifier: createDevOidcVerifier(),
        sessionAuth: createAppSessionAuthService({
            jwtSecret: "fleetfeast-consumer-bff-test-secret",
        }),
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind consumer-bff listener");
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/consumer/orders/order-77`);
        assert.equal(response.status, 200);
        const payload = (await response.json());
        assert.equal(payload.order.id, "order-77");
        assert.equal(payload.order.status, "COURIER_ASSIGNED");
        assert.equal(payload.order.timelineVersion, 9);
        assert.equal(requests[0]?.method, "GET");
        assert.equal(requests[0]?.url, "/api/v1/consumer/orders/order-77");
    }
    finally {
        await app.close();
        await new Promise((resolve, reject) => {
            backend.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
});
//# sourceMappingURL=server.test.js.map