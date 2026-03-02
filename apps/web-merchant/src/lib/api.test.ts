import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import {
  acceptMerchantOrder,
  exchangeMerchantSession,
  fetchMerchantFeatureFlags,
  fetchMerchantOrders,
  fetchMerchantPayoutStatements,
  requestMerchantDispatch,
  refreshMerchantSession,
} from "./api";

test("fetchMerchantOrders calls ops-bff merchant endpoint", async () => {
  const requests: Array<{ method: string; url: string; authorization?: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
      authorization: request.headers.authorization,
    });

    if (request.method === "GET" && request.url === "/app/v1/merchant/orders?merchantId=merchant-1") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ orders: [{ id: "order-1", status: "CREATED" }] }));
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind merchant test backend");
    }

    const orders = await fetchMerchantOrders("merchant-1", {
      opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      appSessionToken: "session-token-1",
    });

    assert.equal(orders.length, 1);
    assert.equal(orders[0]?.id, "order-1");
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/app/v1/merchant/orders?merchantId=merchant-1");
    assert.equal(requests[0]?.authorization, "Bearer session-token-1");
  } finally {
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

test("fetchMerchantFeatureFlags calls ops-bff merchant feature-flags endpoint", async () => {
  const requests: Array<{ method: string; url: string; authorization?: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
      authorization: request.headers.authorization,
    });

    if (
      request.method === "GET" &&
      request.url ===
        "/app/v1/merchant/feature-flags?userId=merchant-user-1&role=merchant_operator&tenantId=metro-1"
    ) {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          flags: {
            "merchant.livePrepBoard": true,
          },
          ttlSeconds: 60,
          generatedAtEpochMillis: 1700000000000,
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind merchant feature-flags test backend");
    }

    const snapshot = await fetchMerchantFeatureFlags(
      {
        userId: "merchant-user-1",
        role: "merchant_operator",
        tenantId: "metro-1",
      },
      {
        opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
        appSessionToken: "session-token-1",
      },
    );

    assert.equal(snapshot.flags["merchant.livePrepBoard"], true);
    assert.equal(snapshot.ttlSeconds, 60);
    assert.equal(snapshot.generatedAtEpochMillis, 1700000000000);
    assert.equal(requests[0]?.method, "GET");
    assert.equal(
      requests[0]?.url,
      "/app/v1/merchant/feature-flags?userId=merchant-user-1&role=merchant_operator&tenantId=metro-1",
    );
    assert.equal(requests[0]?.authorization, "Bearer session-token-1");
  } finally {
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

test("fetchMerchantPayoutStatements calls ops-bff merchant payouts endpoint", async () => {
  const requests: Array<{ method: string; url: string; authorization?: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
      authorization: request.headers.authorization,
    });

    if (request.method === "GET" && request.url === "/app/v1/merchant/payouts?merchantId=merchant-1") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          statements: [
            {
              statementId: "stmt-1",
              payoutBatchId: "batch-1",
              entityType: "MERCHANT",
              entityId: "merchant-1",
              periodStart: "2026-02-01T00:00:00.000Z",
              periodEnd: "2026-02-07T23:59:59.999Z",
              currency: "USD",
              totalAmount: 18250,
              lineItems: [
                {
                  label: "Net payout",
                  amount: 18250,
                },
              ],
              format: "PDF",
              renderedContent: "statement-content",
              createdAt: "2026-02-08T03:00:00.000Z",
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind merchant payouts test backend");
    }

    const statements = await fetchMerchantPayoutStatements("merchant-1", {
      opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      appSessionToken: "session-token-1",
    });

    assert.equal(statements.length, 1);
    assert.equal(statements[0]?.statementId, "stmt-1");
    assert.equal(statements[0]?.totalAmount, 18250);
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/app/v1/merchant/payouts?merchantId=merchant-1");
    assert.equal(requests[0]?.authorization, "Bearer session-token-1");
  } finally {
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

test("acceptMerchantOrder posts merchant accept action route", async () => {
  const requests: Array<{ method: string; url: string; authorization?: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
      authorization: request.headers.authorization,
    });

    if (request.method === "POST" && request.url === "/app/v1/merchant/orders/order-1/accept") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ order: { id: "order-1", status: "CONFIRMED" } }));
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind merchant accept-order test backend");
    }

    const order = await acceptMerchantOrder("order-1", {
      opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      appSessionToken: "session-token-1",
    });

    assert.equal(order.id, "order-1");
    assert.equal(order.status, "CONFIRMED");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/merchant/orders/order-1/accept");
    assert.equal(requests[0]?.authorization, "Bearer session-token-1");
  } finally {
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

test("requestMerchantDispatch posts dispatch request route", async () => {
  const requests: Array<{ method: string; url: string; authorization?: string; body: string }> = [];
  const backend = createHttpServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });

    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        authorization: request.headers.authorization,
        body,
      });

      if (
        request.method === "POST" &&
        request.url === "/app/v1/merchant/orders/order-1/request-dispatch"
      ) {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ order: { id: "order-1", status: "ASSIGNED" } }));
        return;
      }

      response.statusCode = 404;
      response.end();
    });
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind merchant dispatch-request test backend");
    }

    const order = await requestMerchantDispatch(
      "order-1",
      {
        candidates: [
          {
            courierId: "courier-1",
            distanceMeters: 350,
            available: true,
            activeOrders: 0,
            withinRestWindow: true,
          },
        ],
        slaPressure: 0.4,
        merchantSelfDeliveryEnabled: false,
      },
      {
        opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
        appSessionToken: "session-token-1",
      },
    );

    assert.equal(order.id, "order-1");
    assert.equal(order.status, "ASSIGNED");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/merchant/orders/order-1/request-dispatch");
    assert.equal(requests[0]?.authorization, "Bearer session-token-1");
    assert.match(requests[0]?.body ?? "", /\"courierId\":\"courier-1\"/);
    assert.match(requests[0]?.body ?? "", /\"slaPressure\":0.4/);
  } finally {
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

test("exchangeMerchantSession posts to ops-bff session exchange endpoint", async () => {
  const requests: Array<{ method: string; url: string; body: string }> = [];
  const backend = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body: Buffer.concat(chunks).toString("utf8"),
      });

      if (request.method === "POST" && request.url === "/app/v1/merchant/session/exchange") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            session: {
              sessionId: "session-1",
              userId: "merchant-user-1",
              role: "merchant_operator",
              persona: "merchant",
              traceId: "trace-1",
              refreshTokenId: "rt-1",
              issuedAt: "2026-02-19T00:00:00Z",
              expiresAt: "2026-02-19T01:00:00Z",
            },
            tokenPair: {
              tokenType: "Bearer",
              accessToken: "access-1",
              refreshToken: "refresh-1",
              expiresInSeconds: 3600,
              refreshExpiresInSeconds: 2592000,
              refreshExpiresAt: "2026-03-21T00:00:00Z",
            },
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.end();
    });
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind merchant test backend");
    }

    const sessionExchange = await exchangeMerchantSession(
      {
        oidcToken: "dev:merchant-user-1:merchant@fleetfeast.dev:merchant_operator",
        traceId: "trace-1",
        deviceId: "web-merchant",
      },
      {
        opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(sessionExchange.tokenPair.accessToken, "access-1");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/merchant/session/exchange");
    assert.match(requests[0]?.body ?? "", /"oidcToken":"dev:merchant-user-1:merchant@fleetfeast\.dev:merchant_operator"/);
    assert.match(requests[0]?.body ?? "", /"traceId":"trace-1"/);
  } finally {
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

test("refreshMerchantSession posts to ops-bff session refresh endpoint", async () => {
  const requests: Array<{ method: string; url: string; body: string }> = [];
  const backend = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body: Buffer.concat(chunks).toString("utf8"),
      });

      if (request.method === "POST" && request.url === "/app/v1/merchant/session/refresh") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            session: {
              sessionId: "session-2",
              userId: "merchant-user-1",
              role: "merchant_operator",
              persona: "merchant",
              traceId: "trace-2",
              refreshTokenId: "rt-2",
              issuedAt: "2026-02-19T01:00:00Z",
              expiresAt: "2026-02-19T02:00:00Z",
            },
            tokenPair: {
              tokenType: "Bearer",
              accessToken: "access-2",
              refreshToken: "refresh-2",
              expiresInSeconds: 3600,
              refreshExpiresInSeconds: 2592000,
              refreshExpiresAt: "2026-03-21T01:00:00Z",
            },
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.end();
    });
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind merchant test backend");
    }

    const refreshedSession = await refreshMerchantSession(
      {
        refreshToken: "refresh-1",
        traceId: "trace-2",
        deviceId: "web-merchant",
      },
      {
        opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(refreshedSession.tokenPair.accessToken, "access-2");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/merchant/session/refresh");
    assert.match(requests[0]?.body ?? "", /"refreshToken":"refresh-1"/);
    assert.match(requests[0]?.body ?? "", /"traceId":"trace-2"/);
  } finally {
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
