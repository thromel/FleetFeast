import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import { createOpsBffServer, createOpsCoreApiDependencies } from "./server.js";

test("ops-bff serves merchant orders and admin incidents", async () => {
  const app = createOpsBffServer({
    listMerchantOrders: async () => [{ id: "order-1", status: "MERCHANT_ACCEPTED" }],
    listAdminIncidents: async () => [{ id: "incident-1", severity: "HIGH" }],
  });
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff test listener");
    }

    const merchantResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-1`,
    );
    assert.equal(merchantResponse.status, 200);
    const merchantPayload = (await merchantResponse.json()) as {
      orders: Array<{ id: string }>;
    };
    assert.equal(merchantPayload.orders[0]?.id, "order-1");

    const adminResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/incidents`);
    assert.equal(adminResponse.status, 200);
    const adminPayload = (await adminResponse.json()) as {
      incidents: Array<{ id: string }>;
    };
    assert.equal(adminPayload.incidents[0]?.id, "incident-1");
  } finally {
    await app.close();
  }
});

test("ops-bff core-api dependency calls merchant and observability endpoints", async () => {
  const requests: Array<{ method: string; url: string }> = [];
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
      response.end(
        JSON.stringify({
          logs: [
            {
              traceId: "trace-incident-1",
              statusCode: 503,
            },
          ],
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve, reject) => {
    backend.listen(0, "127.0.0.1", (error?: Error) => {
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

  const app = createOpsBffServer(
    createOpsCoreApiDependencies({
      coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
    }),
  );
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff listener");
    }

    const merchantResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-2`,
    );
    assert.equal(merchantResponse.status, 200);
    const merchantPayload = (await merchantResponse.json()) as {
      orders: Array<{ id: string }>;
    };
    assert.equal(merchantPayload.orders[0]?.id, "order-backend-2");

    const adminResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/incidents`);
    assert.equal(adminResponse.status, 200);
    const adminPayload = (await adminResponse.json()) as {
      incidents: Array<{ id: string; severity: string }>;
    };
    assert.equal(adminPayload.incidents[0]?.id, "trace-incident-1");
    assert.equal(adminPayload.incidents[0]?.severity, "HIGH");

    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/api/v1/merchant/orders?merchantId=merchant-2");
    assert.equal(requests[1]?.method, "GET");
    assert.equal(requests[1]?.url, "/internal/observability/logs");
  } finally {
    await app.close();
    await new Promise<void>((resolve, reject) => {
      backend.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
