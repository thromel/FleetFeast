import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import { exchangeMerchantSession, fetchMerchantOrders } from "./api.js";

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

    const accessToken = await exchangeMerchantSession(
      {
        oidcToken: "dev:merchant-user-1:merchant@fleetfeast.dev:merchant_operator",
        traceId: "trace-1",
        deviceId: "web-merchant",
      },
      {
        opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(accessToken, "access-1");
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
