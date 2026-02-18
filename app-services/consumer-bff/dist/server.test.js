import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createConsumerBffServer, createConsumerCoreApiDependencies } from "./server.js";
test("consumer-bff exchanges OIDC token into app session", async () => {
    const app = createConsumerBffServer({
        getOrderById: async () => ({
            id: "order-1",
            status: "DISPATCH_PENDING",
            timelineVersion: 2,
        }),
    });
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
                oidcToken: "oidc-token-1",
                userId: "user-1",
                traceId: "trace-1",
            }),
        });
        assert.equal(response.status, 200);
        const payload = (await response.json());
        assert.equal(payload.session.persona, "consumer");
        assert.equal(payload.session.role, "consumer");
        assert.ok(payload.session.refreshTokenId.length > 0);
    }
    finally {
        await app.close();
    }
});
test("consumer-bff serves consumer order details through adapter", async () => {
    const app = createConsumerBffServer({
        getOrderById: async (orderId) => ({
            id: orderId,
            status: "COURIER_ASSIGNED",
            timelineVersion: 3,
        }),
    });
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
    const app = createConsumerBffServer(createConsumerCoreApiDependencies({
        coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
    }));
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