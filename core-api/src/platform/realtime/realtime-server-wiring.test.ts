import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";
import type { DispatchAssignmentClient } from "../../modules/dispatch/dispatch-assignment-client.js";
import type { RealtimeEnvelope, RealtimeEventPublisher } from "./realtime-event-relay.js";

class RecordingRealtimePublisher implements RealtimeEventPublisher {
  public readonly calls: Array<{ channel: string; envelope: RealtimeEnvelope }> = [];

  async publish(channel: string, envelope: RealtimeEnvelope): Promise<void> {
    this.calls.push({ channel, envelope });
  }
}

async function createCheckout(baseUrl: string): Promise<{ checkoutId: string; quoteHash: string }> {
  const createBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consumerId: "consumer-1",
      merchantId: "merchant-1",
      currency: "USD",
    }),
  });
  assert.equal(createBasket.status, 201);
  const basket = (await createBasket.json()) as { id: string };

  const patchBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets/${basket.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          itemId: "item-1",
          name: "Burger",
          quantity: 1,
          unitPriceCents: 1299,
          modifiers: [],
        },
      ],
    }),
  });
  assert.equal(patchBasket.status, 200);

  const quoteResponse = await fetch(`${baseUrl}/api/v1/consumer/quotes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ basketId: basket.id }),
  });
  assert.equal(quoteResponse.status, 200);
  const quote = (await quoteResponse.json()) as {
    quoteId: string;
    quoteHash: string;
    basketId: string;
  };

  const checkoutResponse = await fetch(`${baseUrl}/api/v1/consumer/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      basketId: quote.basketId,
      quoteId: quote.quoteId,
      quoteHash: quote.quoteHash,
    }),
  });
  assert.equal(checkoutResponse.status, 200);

  return (await checkoutResponse.json()) as { checkoutId: string; quoteHash: string };
}

test("core-api publishes order/dispatch events to realtime channels when publisher is configured", async () => {
  const realtimePublisher = new RecordingRealtimePublisher();
  const dispatchClient: DispatchAssignmentClient = {
    async assign() {
      return {
        assignmentId: "assign-1",
        mode: "COURIER",
        courierId: "courier-1",
        etaSeconds: 600,
        reasonCodes: ["TEST_ASSIGNMENT"],
      };
    },
  };

  const app = createServer({
    realtimeEventPublisher: realtimePublisher,
    dispatchAssignmentClient: dispatchClient,
  });
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind realtime wiring test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const checkout = await createCheckout(baseUrl);

    const createOrder = await fetch(`${baseUrl}/api/v1/consumer/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        checkoutId: checkout.checkoutId,
        quoteHash: checkout.quoteHash,
      }),
    });
    assert.equal(createOrder.status, 201);
    const order = (await createOrder.json()) as { id: string };

    const accept = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/accept`, {
      method: "POST",
    });
    assert.equal(accept.status, 200);

    const requestDispatch = await fetch(`${baseUrl}/internal/orders/${order.id}/request-dispatch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        candidates: [
          {
            courierId: "courier-1",
            distanceMeters: 1200,
            available: true,
            activeOrders: 0,
            withinRestWindow: true,
          },
        ],
        slaPressure: 0.5,
        merchantSelfDeliveryEnabled: false,
      }),
    });
    assert.equal(requestDispatch.status, 200);

    const channels = new Set(realtimePublisher.calls.map((call) => call.channel));
    assert.ok(channels.has(`consumer.order.${order.id}`));
    assert.ok(channels.has(`merchant.order.${order.id}`));
    assert.ok(channels.has(`courier.job.${order.id}`));

    const eventTypes = new Set(
      realtimePublisher.calls
        .map((call) => call.envelope.eventType)
        .filter((value): value is string => typeof value === "string"),
    );

    assert.ok(eventTypes.has("order.created.v1"));
    assert.ok(eventTypes.has("order.confirmed.v1"));
    assert.ok(eventTypes.has("dispatch.assignment.requested.v1"));
    assert.ok(eventTypes.has("dispatch.assignment.completed.v1"));
  } finally {
    listener.close();
  }
});
