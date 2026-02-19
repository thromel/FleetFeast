import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createAppSessionAuthService, createDevOidcVerifier } from "@fleetfeast/app-auth";
import { createOpsBffServer, createOpsCoreApiDependencies } from "./server.js";
function createTestOpsDependencies() {
    return {
        listMerchantOrders: async () => [{ id: "order-1", status: "MERCHANT_ACCEPTED" }],
        listAdminIncidents: async () => [{ id: "incident-1", severity: "HIGH" }],
        getMerchantFeatureFlagSnapshot: async () => ({
            flags: {
                "merchant.livePrepBoard": true,
            },
            ttlSeconds: 30,
            generatedAtEpochMillis: 1_735_681_600_000,
        }),
        getAdminFeatureFlagSnapshot: async () => ({
            flags: {
                "admin.incidentWorkbenchV2": false,
            },
            ttlSeconds: 30,
            generatedAtEpochMillis: 1_735_681_600_000,
        }),
        oidcVerifier: createDevOidcVerifier(),
        sessionAuth: createAppSessionAuthService({
            jwtSecret: "fleetfeast-ops-bff-test-secret",
        }),
    };
}
test("ops-bff exchanges merchant and admin sessions with persona role boundaries", async () => {
    const app = createOpsBffServer(createTestOpsDependencies());
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind ops-bff test listener");
        }
        const merchantExchange = await fetch(`http://127.0.0.1:${address.port}/app/v1/merchant/session/exchange`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                oidcToken: "dev:merchant-user-1:merchant-1@fleetfeast.dev:merchant_operator",
                traceId: "trace-merchant-1",
            }),
        });
        assert.equal(merchantExchange.status, 200);
        const merchantPayload = (await merchantExchange.json());
        assert.equal(merchantPayload.session.persona, "merchant");
        assert.equal(merchantPayload.session.role, "merchant_operator");
        const adminExchange = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/session/exchange`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                oidcToken: "dev:admin-user-1:admin-1@fleetfeast.dev:system_admin",
                traceId: "trace-admin-1",
            }),
        });
        assert.equal(adminExchange.status, 200);
        const adminPayload = (await adminExchange.json());
        assert.equal(adminPayload.session.persona, "admin");
        assert.equal(adminPayload.session.role, "system_admin");
        const forbiddenMerchant = await fetch(`http://127.0.0.1:${address.port}/app/v1/merchant/session/exchange`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                oidcToken: "dev:wrong-user:wrong@fleetfeast.dev:consumer",
                traceId: "trace-merchant-forbidden",
            }),
        });
        assert.equal(forbiddenMerchant.status, 403);
        const forbiddenPayload = (await forbiddenMerchant.json());
        assert.equal(forbiddenPayload.errorCode, "MERCHANT_ROLE_REQUIRED");
    }
    finally {
        await app.close();
    }
});
test("ops-bff refresh endpoint rotates admin refresh token", async () => {
    const app = createOpsBffServer(createTestOpsDependencies());
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind ops-bff test listener");
        }
        const exchange = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/session/exchange`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                oidcToken: "dev:admin-user-2:admin-2@fleetfeast.dev:support_agent",
                traceId: "trace-exchange",
            }),
        });
        assert.equal(exchange.status, 200);
        const exchangePayload = (await exchange.json());
        const refresh = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/session/refresh`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                refreshToken: exchangePayload.tokenPair.refreshToken,
                traceId: "trace-refresh",
            }),
        });
        assert.equal(refresh.status, 200);
        const refreshPayload = (await refresh.json());
        assert.notEqual(refreshPayload.tokenPair.refreshToken, exchangePayload.tokenPair.refreshToken);
    }
    finally {
        await app.close();
    }
});
test("ops-bff serves merchant orders and admin incidents", async () => {
    const app = createOpsBffServer(createTestOpsDependencies());
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind ops-bff test listener");
        }
        const merchantResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-1`);
        assert.equal(merchantResponse.status, 200);
        const merchantPayload = (await merchantResponse.json());
        assert.equal(merchantPayload.orders[0]?.id, "order-1");
        const adminResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/incidents`);
        assert.equal(adminResponse.status, 200);
        const adminPayload = (await adminResponse.json());
        assert.equal(adminPayload.incidents[0]?.id, "incident-1");
    }
    finally {
        await app.close();
    }
});
test("ops-bff returns merchant and admin feature-flag snapshots", async () => {
    const app = createOpsBffServer(createTestOpsDependencies());
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind ops-bff test listener");
        }
        const merchantResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/merchant/feature-flags?userId=merchant-1&role=merchant_operator&tenantId=metro-1`);
        assert.equal(merchantResponse.status, 200);
        const merchantPayload = (await merchantResponse.json());
        assert.equal(merchantPayload.flags["merchant.livePrepBoard"], true);
        assert.equal(merchantPayload.ttlSeconds, 30);
        const adminResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/feature-flags?userId=admin-1&role=system_admin&tenantId=metro-1`);
        assert.equal(adminResponse.status, 200);
        const adminPayload = (await adminResponse.json());
        assert.equal(adminPayload.flags["admin.incidentWorkbenchV2"], false);
        assert.equal(adminPayload.ttlSeconds, 30);
    }
    finally {
        await app.close();
    }
});
test("ops-bff core-api dependency calls merchant and observability endpoints", async () => {
    const requests = [];
    const backend = createHttpServer((request, response) => {
        requests.push({
            method: request.method ?? "",
            url: request.url ?? "",
        });
        if (request.method === "GET" && request.url === "/api/v1/merchant/orders?merchantId=merchant-2") {
            response.statusCode = 200;
            response.setHeader("content-type", "application/json");
            response.end(JSON.stringify({ orders: [{ id: "order-backend-2", status: "READY" }] }));
            return;
        }
        if (request.method === "GET" && request.url === "/internal/observability/logs") {
            response.statusCode = 200;
            response.setHeader("content-type", "application/json");
            response.end(JSON.stringify({
                logs: [
                    {
                        traceId: "trace-incident-1",
                        statusCode: 503,
                    },
                ],
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
        throw new Error("Failed to bind ops backend stub");
    }
    const app = createOpsBffServer({
        ...createOpsCoreApiDependencies({
            coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
        }),
        oidcVerifier: createDevOidcVerifier(),
        sessionAuth: createAppSessionAuthService({
            jwtSecret: "fleetfeast-ops-bff-test-secret",
        }),
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind ops-bff listener");
        }
        const merchantResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-2`);
        assert.equal(merchantResponse.status, 200);
        const merchantPayload = (await merchantResponse.json());
        assert.equal(merchantPayload.orders[0]?.id, "order-backend-2");
        const adminResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/incidents`);
        assert.equal(adminResponse.status, 200);
        const adminPayload = (await adminResponse.json());
        assert.equal(adminPayload.incidents[0]?.id, "trace-incident-1");
        assert.equal(adminPayload.incidents[0]?.severity, "HIGH");
        assert.equal(requests[0]?.method, "GET");
        assert.equal(requests[0]?.url, "/api/v1/merchant/orders?merchantId=merchant-2");
        assert.equal(requests[1]?.method, "GET");
        assert.equal(requests[1]?.url, "/internal/observability/logs");
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