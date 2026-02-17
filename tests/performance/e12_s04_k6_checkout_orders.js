import http from "k6/http";
import { check, sleep } from "k6";

const profile = JSON.parse(open("./e12_s04_load_profile.json"));
const baseUrl = __ENV.LOAD_TEST_BASE_URL || "http://127.0.0.1:3000";
const authToken = __ENV.LOAD_TEST_AUTH_TOKEN || "";

function phaseToStage(phase) {
  return {
    duration: `${phase.durationMinutes}m`,
    target: phase.targetVUs
  };
}

const phases = profile.loadModel.phases;

export const options = {
  scenarios: {
    checkout_order_flow: {
      executor: "ramping-vus",
      startVUs: phases[0].startVUs,
      stages: phases.map(phaseToStage),
      gracefulRampDown: "1m"
    }
  },
  thresholds: {
    http_req_failed: [profile.thresholds["http_req_failed"]],
    "http_req_duration{endpoint:checkout}": [
      profile.thresholds["http_req_duration{endpoint:checkout}"]
    ],
    "http_req_duration{endpoint:timeline}": [
      profile.thresholds["http_req_duration{endpoint:timeline}"]
    ],
    checks: [profile.thresholds.checks]
  }
};

function headers() {
  const baseHeaders = {
    "Content-Type": "application/json",
    "x-role": "consumer"
  };

  if (authToken.trim().length > 0) {
    baseHeaders.Authorization = `Bearer ${authToken}`;
  }

  return baseHeaders;
}

function createBasket(runId) {
  const body = JSON.stringify({
    consumerId: `consumer-${runId}`,
    merchantId: "merchant-load-1",
    currency: "USD",
    items: [{ itemId: "item-load-1", quantity: 1 }]
  });

  const response = http.post(`${baseUrl}/api/v1/consumer/baskets`, body, {
    headers: headers(),
    tags: { endpoint: "basket" }
  });

  check(response, {
    "basket status is success": (res) => res.status === 201 || res.status === 200
  });

  return response;
}

function createQuote(basketId) {
  const body = JSON.stringify({
    basketId,
    deliveryAddress: {
      latitude: 37.7749,
      longitude: -122.4194
    }
  });

  const response = http.post(`${baseUrl}/api/v1/consumer/quotes`, body, {
    headers: headers(),
    tags: { endpoint: "quote" }
  });

  check(response, {
    "quote status is 200": (res) => res.status === 200
  });

  return response;
}

function checkout(basketId, quoteId) {
  const body = JSON.stringify({
    basketId,
    quoteId,
    quoteSnapshotHash: `snapshot-${quoteId}`,
    paymentMethod: "CARD"
  });

  const response = http.post(`${baseUrl}/api/v1/consumer/checkout`, body, {
    headers: headers(),
    tags: { endpoint: "checkout" }
  });

  check(response, {
    "checkout status is 200": (res) => res.status === 200
  });

  return response;
}

function createOrder(checkoutId, runId) {
  const body = JSON.stringify({
    checkoutId,
    idempotencyKey: `load-${runId}`
  });

  const response = http.post(`${baseUrl}/api/v1/consumer/orders`, body, {
    headers: headers(),
    tags: { endpoint: "orders" }
  });

  check(response, {
    "order status is success": (res) => res.status === 201 || res.status === 200
  });

  return response;
}

function readTimeline(orderId) {
  const response = http.get(`${baseUrl}/api/v1/consumer/orders/${orderId}/timeline`, {
    headers: headers(),
    tags: { endpoint: "timeline" }
  });

  check(response, {
    "timeline status is 200": (res) => res.status === 200
  });

  return response;
}

export default function () {
  const runId = `${__VU}-${__ITER}-${Date.now()}`;
  const basketResponse = createBasket(runId);
  const basketPayload = basketResponse.json() || {};
  const basketId = basketPayload.basketId;

  if (!basketId) {
    sleep(1);
    return;
  }

  const quoteResponse = createQuote(basketId);
  const quotePayload = quoteResponse.json() || {};
  const quoteId = quotePayload.quoteId;

  if (!quoteId) {
    sleep(1);
    return;
  }

  const checkoutResponse = checkout(basketId, quoteId);
  const checkoutPayload = checkoutResponse.json() || {};
  const checkoutId = checkoutPayload.checkoutId;

  if (!checkoutId) {
    sleep(1);
    return;
  }

  const orderResponse = createOrder(checkoutId, runId);
  const orderPayload = orderResponse.json() || {};
  const orderId = orderPayload.orderId;

  if (orderId) {
    readTimeline(orderId);
  }

  sleep(1);
}
