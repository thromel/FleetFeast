import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createCourierBffServer, createCourierCoreApiDependencies } from "./server.js";
test("courier-bff exchanges OIDC token into courier-scoped app session", async () => {
    const app = createCourierBffServer({
        listAvailableJobs: async () => [],
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind courier-bff test listener");
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/session/exchange`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                oidcToken: "oidc-token-courier",
                userId: "courier-user-1",
                traceId: "trace-courier-1",
            }),
        });
        assert.equal(response.status, 200);
        const payload = (await response.json());
        assert.equal(payload.session.persona, "courier");
        assert.equal(payload.session.role, "courier");
    }
    finally {
        await app.close();
    }
});
test("courier-bff returns available jobs", async () => {
    const app = createCourierBffServer({
        listAvailableJobs: async () => [
            {
                jobId: "job-1",
                orderId: "order-1",
                status: "AVAILABLE",
            },
        ],
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind courier-bff test listener");
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/jobs/available`);
        assert.equal(response.status, 200);
        const payload = (await response.json());
        assert.equal(payload.jobs.length, 1);
        assert.equal(payload.jobs[0]?.jobId, "job-1");
    }
    finally {
        await app.close();
    }
});
test("courier-bff core-api dependency calls backend available jobs endpoint", async () => {
    const requests = [];
    const backend = createHttpServer((request, response) => {
        requests.push({
            method: request.method ?? "",
            url: request.url ?? "",
        });
        if (request.method === "GET" && request.url === "/api/v1/courier/jobs/available") {
            response.statusCode = 200;
            response.setHeader("content-type", "application/json");
            response.end(JSON.stringify({
                jobs: [{ jobId: "job-backend-1", orderId: "order-backend-1", status: "AVAILABLE" }],
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
        throw new Error("Failed to bind courier backend stub");
    }
    const app = createCourierBffServer(createCourierCoreApiDependencies({
        coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
    }));
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
        const address = app.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Failed to bind courier-bff listener");
        }
        const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/jobs/available`);
        assert.equal(response.status, 200);
        const payload = (await response.json());
        assert.equal(payload.jobs.length, 1);
        assert.equal(payload.jobs[0]?.jobId, "job-backend-1");
        assert.equal(requests[0]?.method, "GET");
        assert.equal(requests[0]?.url, "/api/v1/courier/jobs/available");
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