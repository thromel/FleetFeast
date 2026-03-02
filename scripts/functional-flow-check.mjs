import assert from "node:assert/strict";

import { WebSocket } from "ws";

import { createServer as createCoreApiServer } from "../core-api/dist/server.js";
import { createConsumerBffServerFromEnv } from "../app-services/consumer-bff/dist/server.js";
import { createCourierBffServerFromEnv } from "../app-services/courier-bff/dist/server.js";
import { createOpsBffServerFromEnv } from "../app-services/ops-bff/dist/server.js";
import { createRealtimeGatewayServerFromEnv } from "../app-services/realtime-gateway/dist/server.js";

async function listenServer(app, name) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error(`Failed to bind ${name}`);
  }
  return `http://127.0.0.1:${address.port}`;
}

function waitForWebSocketOpen(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("WebSocket open timeout"));
    }, 10_000);

    socket.once("open", () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const realtimeGateway = createRealtimeGatewayServerFromEnv();
  const realtimeBaseUrl = await listenServer(realtimeGateway.app, "realtime-gateway");

  process.env.REALTIME_GATEWAY_BASE_URL = realtimeBaseUrl;
  const coreApi = createCoreApiServer();
  const coreApiListener = coreApi.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    coreApiListener.once("listening", resolve);
    coreApiListener.once("error", reject);
  });
  const coreAddress = coreApiListener.address();
  if (!coreAddress || typeof coreAddress === "string") {
    throw new Error("Failed to bind core-api");
  }
  const coreApiBaseUrl = `http://127.0.0.1:${coreAddress.port}`;

  process.env.CORE_API_BASE_URL = coreApiBaseUrl;

  const consumerBff = createConsumerBffServerFromEnv();
  const consumerBaseUrl = await listenServer(consumerBff, "consumer-bff");
  const courierBff = createCourierBffServerFromEnv();
  const courierBaseUrl = await listenServer(courierBff, "courier-bff");
  const opsBff = createOpsBffServerFromEnv();
  const opsBaseUrl = await listenServer(opsBff, "ops-bff");

  let websocket;

  try {
    const merchantExchange = await fetch(`${opsBaseUrl}/app/v1/merchant/session/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        oidcToken: "dev:merchant-1:merchant-1@fleetfeast.dev:merchant_operator",
        traceId: "trace-merchant-exchange-1",
      }),
    });
    assert.equal(merchantExchange.status, 200);
    const merchantPayload = await merchantExchange.json();
    const merchantAccessToken = merchantPayload.tokenPair.accessToken;

    const quickCreate = await fetch(`${consumerBaseUrl}/app/v1/consumer/orders/quick-create`, {
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
    assert.equal(quickCreate.status, 201);
    const quickCreatePayload = await quickCreate.json();
    const orderId = quickCreatePayload.order.id;

    const channelEvents = [];
    websocket = new WebSocket(
      `${realtimeBaseUrl.replace("http://", "ws://")}/app/v1/realtime/connect?channel=${encodeURIComponent(`consumer.order.${orderId}`)}`,
    );
    websocket.on("message", (message) => {
      const parsed = JSON.parse(message.toString("utf8"));
      channelEvents.push(parsed.eventType);
    });

    await waitForWebSocketOpen(websocket);

    const accept = await fetch(`${opsBaseUrl}/app/v1/merchant/orders/${encodeURIComponent(orderId)}/accept`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${merchantAccessToken}`,
      },
    });
    assert.equal(accept.status, 200);

    const requestDispatch = await fetch(
      `${opsBaseUrl}/app/v1/merchant/orders/${encodeURIComponent(orderId)}/request-dispatch`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${merchantAccessToken}`,
        },
        body: JSON.stringify({
          candidates: [
            {
              courierId: "courier-1",
              distanceMeters: 950,
              available: true,
              activeOrders: 0,
              withinRestWindow: true,
            },
          ],
          slaPressure: 0.4,
          merchantSelfDeliveryEnabled: false,
        }),
      },
    );
    assert.equal(requestDispatch.status, 200);

    const availableJobs = await fetch(`${courierBaseUrl}/app/v1/courier/jobs/available`);
    assert.equal(availableJobs.status, 200);
    const availableJobsPayload = await availableJobs.json();
    const job = availableJobsPayload.jobs.find((candidate) => candidate.jobId === orderId);
    assert.ok(job, "Expected job for created order");

    const acceptJob = await fetch(`${courierBaseUrl}/app/v1/courier/jobs/${encodeURIComponent(orderId)}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(acceptJob.status, 200);

    const pickupJob = await fetch(`${courierBaseUrl}/app/v1/courier/jobs/${encodeURIComponent(orderId)}/pickup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(pickupJob.status, 200);

    const dropoffJob = await fetch(`${courierBaseUrl}/app/v1/courier/jobs/${encodeURIComponent(orderId)}/dropoff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(dropoffJob.status, 200);

    const consumerOrder = await fetch(`${consumerBaseUrl}/app/v1/consumer/orders/${encodeURIComponent(orderId)}`);
    assert.equal(consumerOrder.status, 200);
    const consumerOrderPayload = await consumerOrder.json();
    assert.equal(consumerOrderPayload.order.status, "DELIVERED");

    await waitFor(300);

    const expectedEvents = [
      "order.confirmed.v1",
      "dispatch.assignment.requested.v1",
      "dispatch.assignment.completed.v1",
      "order.picked_up.v1",
      "order.delivered.v1",
    ];

    for (const eventType of expectedEvents) {
      assert.ok(channelEvents.includes(eventType), `Missing realtime event: ${eventType}`);
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          orderId,
          finalOrderStatus: consumerOrderPayload.order.status,
          realtimeEvents: channelEvents,
        },
        null,
        2,
      ),
    );
  } finally {
    if (websocket) {
      websocket.close();
    }
    await Promise.all([
      consumerBff.close(),
      courierBff.close(),
      opsBff.close(),
      realtimeGateway.app.close(),
    ]);
    await new Promise((resolve) => {
      coreApiListener.close(() => resolve());
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
