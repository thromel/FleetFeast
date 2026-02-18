import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";
import type { DispatchAssignmentInput } from "../dispatch/dispatch-assignment-client.js";

async function createAcceptedOrder(baseUrl: string): Promise<{ id: string }> {
  const createBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consumerId: "consumer-1",
      merchantId: "merchant-1",
      currency: "USD",
    }),
  });

  const basket = (await createBasket.json()) as { id: string };

  await fetch(`${baseUrl}/api/v1/consumer/baskets/${basket.id}`, {
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

  const quoteResponse = await fetch(`${baseUrl}/api/v1/consumer/quotes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ basketId: basket.id }),
  });
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
  const checkout = (await checkoutResponse.json()) as {
    checkoutId: string;
    quoteHash: string;
  };

  const createOrder = await fetch(`${baseUrl}/api/v1/consumer/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      checkoutId: checkout.checkoutId,
      quoteHash: checkout.quoteHash,
    }),
  });
  const order = (await createOrder.json()) as { id: string };

  const accept = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/accept`, {
    method: "POST",
  });
  assert.equal(accept.status, 200);

  return order;
}

test("dispatch request endpoint transitions order to DISPATCH_PENDING", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createAcceptedOrder(baseUrl);

    const dispatch = await fetch(`${baseUrl}/internal/orders/${order.id}/request-dispatch`, {
      method: "POST",
    });

    assert.equal(dispatch.status, 200);
    const payload = (await dispatch.json()) as { status: string };
    assert.equal(payload.status, "DISPATCH_PENDING");
  } finally {
    listener.close();
  }
});

test("dispatch request endpoint can orchestrate assignment through dispatch client", async () => {
  const app = createServer({
    dispatchAssignmentClient: {
      async assign(input: DispatchAssignmentInput) {
        assert.equal(input.slaPressure, 0.6);
        assert.equal(input.merchantSelfDeliveryEnabled, false);
        assert.equal(input.candidates.length, 2);

        return {
          assignmentId: "asg-order-1-courier-7",
          mode: "COURIER",
          courierId: "courier-7",
          etaSeconds: 540,
          reasonCodes: ["DISTANCE_OK", "CAPACITY_OK"],
        };
      },
    },
  });
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createAcceptedOrder(baseUrl);

    const dispatch = await fetch(`${baseUrl}/internal/orders/${order.id}/request-dispatch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        candidates: [
          {
            courierId: "courier-7",
            distanceMeters: 1200,
            available: true,
            activeOrders: 1,
            withinRestWindow: true,
          },
          {
            courierId: "courier-8",
            distanceMeters: 1500,
            available: true,
            activeOrders: 2,
            withinRestWindow: true,
          },
        ],
        slaPressure: 0.6,
        merchantSelfDeliveryEnabled: false,
      }),
    });

    assert.equal(dispatch.status, 200);
    const payload = (await dispatch.json()) as {
      status: string;
      courierId: string | null;
      assignment?: {
        assignmentId: string;
        mode: string;
        courierId: string | null;
        etaSeconds: number;
        reasonCodes: string[];
      };
    };

    assert.equal(payload.status, "COURIER_ASSIGNED");
    assert.equal(payload.courierId, "courier-7");
    assert.ok(payload.assignment);
    assert.equal(payload.assignment?.assignmentId, "asg-order-1-courier-7");
    assert.equal(payload.assignment?.mode, "COURIER");
    assert.equal(payload.assignment?.courierId, "courier-7");
  } finally {
    listener.close();
  }
});
