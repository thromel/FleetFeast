import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import { createConsumerQuickOrder, fetchConsumerOrder } from "./api";

test("createConsumerQuickOrder posts quick-create payload to consumer-bff", async () => {
  const requests: Array<{ method: string; url: string; body: string }> = [];
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
        body,
      });

      if (request.method === "POST" && request.url === "/app/v1/consumer/orders/quick-create") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ order: { id: "order-1", status: "CREATED", timelineVersion: 2 } }));
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
      throw new Error("Failed to bind consumer quick-create test backend");
    }

    const order = await createConsumerQuickOrder(
      {
        consumerId: "consumer-1",
        merchantId: "merchant-1",
        currency: "USD",
        item: {
          itemId: "item-1",
          name: "Chicken Rice",
          quantity: 1,
          unitPriceCents: 1250,
          modifiers: [{ name: "Extra Sauce", priceCents: 100 }],
        },
      },
      {
        consumerBffBaseUrl: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(order.id, "order-1");
    assert.equal(order.status, "CREATED");
    assert.equal(order.timelineVersion, 2);
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/consumer/orders/quick-create");
    assert.match(requests[0]?.body ?? "", /"consumerId":"consumer-1"/);
    assert.match(requests[0]?.body ?? "", /"itemId":"item-1"/);
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

test("fetchConsumerOrder calls consumer-bff order endpoint", async () => {
  const requests: Array<{ method: string; url: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
    });

    if (request.method === "GET" && request.url === "/app/v1/consumer/orders/order-1") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ order: { id: "order-1", status: "ASSIGNED", timelineVersion: 6 } }));
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
      throw new Error("Failed to bind consumer order test backend");
    }

    const order = await fetchConsumerOrder("order-1", {
      consumerBffBaseUrl: `http://127.0.0.1:${address.port}`,
    });

    assert.equal(order.id, "order-1");
    assert.equal(order.status, "ASSIGNED");
    assert.equal(order.timelineVersion, 6);
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/app/v1/consumer/orders/order-1");
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
