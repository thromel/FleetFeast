import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createAppSessionAuthService, createDevOidcVerifier } from "@fleetfeast/app-auth";
import { createOpsBffServer, createOpsCoreApiDependencies } from "./server.js";
test("ops-bff merchant action routes accept and request dispatch", async () => {
    const sessionAuth = createAppSessionAuthService({
        jwtSecret: "fleetfeast-ops-bff-merchant-actions-test-secret",
    });
    const merchantAccessToken = (await sessionAuth.issueSession({
        userId: "merchant-1",
        role: "merchant_operator",
        persona: "merchant",
        traceId: "trace-merchant-actions-1",
    })).tokenPair.accessToken;
    const app = createOpsBffServer({
        listMerchantOrders: async () => [],
        listMerchantPayoutStatements: async () => [],
        listAdminIncidents: async () => [],
        listAdminComplianceAuditEvents: async () => [],
        getAdminSloDashboard: async () => ({
            availabilityPercent: 99,
            checkoutP95Ms: 500,
            timelineP95Ms: 300,
            breaches: [],
        }),
        getMerchantFeatureFlagSnapshot: async () => ({
            flags: { "merchant.livePrepBoard": true },
            ttlSeconds: 30,
            generatedAtEpochMillis: 1,
        }),
        getAdminFeatureFlagSnapshot: async () => ({
            flags: { "admin.incidentWorkbenchV2": false },
            ttlSeconds: 30,
            generatedAtEpochMillis: 1,
        }),
        acceptMerchantOrder: async (orderId) => ({
            id: orderId,
            status: "MERCHANT_ACCEPTED",
        }),
        requestDispatchAssignment: async (orderId) => ({
            id: orderId,
            status: "DISPATCH_PENDING",
        }),
        oidcVerifier: createDevOidcVerifier(),
        sessionAuth,
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind ops-bff merchant actions listener");
        }
        const accept = await fetch(`http://127.0.0.1:${address.port}/app/v1/merchant/orders/order-1/accept`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${merchantAccessToken}`,
            },
        });
        assert.equal(accept.status, 200);
        const acceptPayload = (await accept.json());
        assert.equal(acceptPayload.order.status, "MERCHANT_ACCEPTED");
        const dispatch = await fetch(`http://127.0.0.1:${address.port}/app/v1/merchant/orders/order-1/request-dispatch`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${merchantAccessToken}`,
            },
            body: JSON.stringify({
                candidates: [
                    {
                        courierId: "courier-1",
                        distanceMeters: 1000,
                        available: true,
                        activeOrders: 0,
                        withinRestWindow: true,
                    },
                ],
                slaPressure: 0.5,
                merchantSelfDeliveryEnabled: false,
            }),
        });
        assert.equal(dispatch.status, 200);
        const dispatchPayload = (await dispatch.json());
        assert.equal(dispatchPayload.order.status, "DISPATCH_PENDING");
    }
    finally {
        await app.close();
    }
});
test("ops core-api dependencies call merchant accept and dispatch request endpoints", async () => {
    const requests = [];
    const backend = createHttpServer((request, response) => {
        const chunks = [];
        request.on("data", (chunk) => {
            chunks.push(Buffer.from(chunk));
        });
        request.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            requests.push({
                method: request.method ?? "",
                url: request.url ?? "",
                body,
            });
            if (request.method === "POST" && request.url === "/api/v1/merchant/orders/order-1/accept") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({ id: "order-1", status: "MERCHANT_ACCEPTED" }));
                return;
            }
            if (request.method === "POST" && request.url === "/internal/orders/order-1/request-dispatch") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({ id: "order-1", status: "DISPATCH_PENDING" }));
                return;
            }
            if (request.method === "GET" && request.url === "/api/v1/merchant/orders?merchantId=merchant-1") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({ orders: [] }));
                return;
            }
            if (request.method === "GET" && request.url === "/api/v1/merchant/payouts?merchantId=merchant-1") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({ statements: [] }));
                return;
            }
            if (request.method === "GET" && request.url === "/internal/observability/logs") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({ logs: [] }));
                return;
            }
            if (request.method === "GET" && request.url === "/internal/risk/compliance/audit/events") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({ events: [] }));
                return;
            }
            if (request.method === "GET" && request.url === "/internal/observability/slo/dashboard") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({
                    availabilityPercent: 99,
                    checkoutP95Ms: 500,
                    timelineP95Ms: 300,
                    breaches: [],
                }));
                return;
            }
            response.statusCode = 404;
            response.end();
        });
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
        throw new Error("Failed to bind ops core-api backend stub");
    }
    try {
        const dependencies = createOpsCoreApiDependencies({
            coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
        });
        const accepted = await dependencies.acceptMerchantOrder("order-1");
        const dispatch = await dependencies.requestDispatchAssignment("order-1", {
            candidates: [
                {
                    courierId: "courier-1",
                    distanceMeters: 1000,
                    available: true,
                    activeOrders: 0,
                    withinRestWindow: true,
                },
            ],
            slaPressure: 0.5,
            merchantSelfDeliveryEnabled: false,
        });
        assert.equal(accepted.status, "MERCHANT_ACCEPTED");
        assert.equal(dispatch.status, "DISPATCH_PENDING");
        assert.deepEqual(requests.map((request) => `${request.method} ${request.url}`), [
            "POST /api/v1/merchant/orders/order-1/accept",
            "POST /internal/orders/order-1/request-dispatch",
        ]);
    }
    finally {
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
//# sourceMappingURL=merchant-actions.test.js.map