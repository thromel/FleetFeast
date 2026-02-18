import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import { fetchMerchantOrders } from "./api.js";

test("fetchMerchantOrders calls ops-bff merchant endpoint", async () => {
  const requests: Array<{ method: string; url: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? ""
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
      opsBffBaseUrl: `http://127.0.0.1:${address.port}`
    });

    assert.equal(orders.length, 1);
    assert.equal(orders[0]?.id, "order-1");
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/app/v1/merchant/orders?merchantId=merchant-1");
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
