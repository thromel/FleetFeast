import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createAppSessionAuthService, createDevOidcVerifier } from "@fleetfeast/app-auth";
import { createConsumerBffServer, createConsumerCoreApiDependencies } from "./server.js";
test("consumer-bff quick-create route returns created order", async () => {
    const app = createConsumerBffServer({
        getOrderById: async (orderId) => ({
            id: orderId,
            status: "CREATED",
            timelineVersion: 0,
        }),
        getFeatureFlagSnapshot: async () => ({
            flags: { "consumer.timelineV2": true },
            ttlSeconds: 30,
            generatedAtEpochMillis: 1,
        }),
        quickCreateOrder: async () => ({
            id: "order-quick-1",
            status: "CREATED",
            timelineVersion: 0,
        }),
        oidcVerifier: createDevOidcVerifier(),
        sessionAuth: createAppSessionAuthService({
            jwtSecret: "fleetfeast-consumer-bff-functional-actions-test-secret",
        }),
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind consumer-bff functional actions listener");
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/consumer/orders/quick-create`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                consumerId: "consumer-1",
                merchantId: "merchant-1",
                currency: "USD",
                item: {
                    itemId: "item-1",
                    name: "Burger",
                    quantity: 1,
                    unitPriceCents: 1299,
                    modifiers: [],
                },
            }),
        });
        assert.equal(response.status, 201);
        const payload = (await response.json());
        assert.equal(payload.order.id, "order-quick-1");
        assert.equal(payload.order.status, "CREATED");
    }
    finally {
        await app.close();
    }
});
test("consumer core-api dependencies quick-create flow calls basket quote checkout and order endpoints", async () => {
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
            if (request.method === "POST" && request.url === "/api/v1/consumer/baskets") {
                response.statusCode = 201;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({ id: "basket-1" }));
                return;
            }
            if (request.method === "PATCH" && request.url === "/api/v1/consumer/baskets/basket-1") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({ id: "basket-1" }));
                return;
            }
            if (request.method === "POST" && request.url === "/api/v1/consumer/quotes") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({
                    quoteId: "quote-1",
                    quoteHash: "quote-hash-1",
                    basketId: "basket-1",
                }));
                return;
            }
            if (request.method === "POST" && request.url === "/api/v1/consumer/checkout") {
                response.statusCode = 200;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({
                    checkoutId: "checkout-1",
                    quoteHash: "quote-hash-1",
                }));
                return;
            }
            if (request.method === "POST" && request.url === "/api/v1/consumer/orders") {
                response.statusCode = 201;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({
                    id: "order-1",
                    status: "CREATED",
                    timelineVersion: 0,
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
        throw new Error("Failed to bind consumer core-api backend stub");
    }
    try {
        const dependencies = createConsumerCoreApiDependencies({
            coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
        });
        const order = await dependencies.quickCreateOrder({
            consumerId: "consumer-1",
            merchantId: "merchant-1",
            currency: "USD",
            item: {
                itemId: "item-1",
                name: "Burger",
                quantity: 1,
                unitPriceCents: 1299,
                modifiers: [
                    {
                        name: "extra-cheese",
                        priceCents: 100,
                    },
                ],
            },
        });
        assert.equal(order.id, "order-1");
        assert.equal(order.status, "CREATED");
        assert.deepEqual(requests.map((request) => `${request.method} ${request.url}`), [
            "POST /api/v1/consumer/baskets",
            "PATCH /api/v1/consumer/baskets/basket-1",
            "POST /api/v1/consumer/quotes",
            "POST /api/v1/consumer/checkout",
            "POST /api/v1/consumer/orders",
        ]);
        const patchBody = JSON.parse(requests[1]?.body ?? "{}");
        assert.equal(patchBody.items?.[0]?.unitPriceCents, 1399);
        assert.deepEqual(patchBody.items?.[0]?.modifiers, ["extra-cheese"]);
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
//# sourceMappingURL=functional-actions.test.js.map