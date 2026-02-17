import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function createDispatchPendingOrder(baseUrl: string): Promise<{ id: string }> {
  const createBasket = await fetch(`${baseUrl}/api/v1/consumer/baskets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consumerId: "consumer-courier-job",
      merchantId: "merchant-courier-job",
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
          itemId: "item-courier-job",
          name: "Ramen",
          quantity: 1,
          unitPriceCents: 1399,
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

  const createOrderResponse = await fetch(`${baseUrl}/api/v1/consumer/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      checkoutId: checkout.checkoutId,
      quoteHash: checkout.quoteHash,
    }),
  });
  assert.equal(createOrderResponse.status, 201);
  const order = (await createOrderResponse.json()) as { id: string };

  const acceptResponse = await fetch(`${baseUrl}/api/v1/merchant/orders/${order.id}/accept`, {
    method: "POST",
  });
  assert.equal(acceptResponse.status, 200);

  const dispatchResponse = await fetch(`${baseUrl}/internal/orders/${order.id}/request-dispatch`, {
    method: "POST",
  });
  assert.equal(dispatchResponse.status, 200);

  return order;
}

test("courier job lifecycle routes expose available jobs and progress status", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createDispatchPendingOrder(baseUrl);

    const availableResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/available`);
    assert.equal(availableResponse.status, 200);

    const availablePayload = (await availableResponse.json()) as {
      jobs: Array<{ jobId: string; orderId: string; status: string }>;
    };
    const availableJob = availablePayload.jobs.find((job) => job.jobId === order.id);
    assert.ok(availableJob);
    assert.equal(availableJob?.status, "AVAILABLE");

    const acceptResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(acceptResponse.status, 200);
    const accepted = (await acceptResponse.json()) as { status: string; courierId: string | null };
    assert.equal(accepted.status, "ACCEPTED");
    assert.equal(accepted.courierId, "courier-1");

    const orderAfterAcceptResponse = await fetch(`${baseUrl}/api/v1/consumer/orders/${order.id}`);
    assert.equal(orderAfterAcceptResponse.status, 200);
    const orderAfterAccept = (await orderAfterAcceptResponse.json()) as {
      status: string;
      courierId: string | null;
    };
    assert.equal(orderAfterAccept.status, "COURIER_ASSIGNED");
    assert.equal(orderAfterAccept.courierId, "courier-1");

    const pickupResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}/pickup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(pickupResponse.status, 200);
    const pickedUp = (await pickupResponse.json()) as { status: string };
    assert.equal(pickedUp.status, "PICKED_UP");

    const orderAfterPickupResponse = await fetch(`${baseUrl}/api/v1/consumer/orders/${order.id}`);
    assert.equal(orderAfterPickupResponse.status, 200);
    const orderAfterPickup = (await orderAfterPickupResponse.json()) as { status: string };
    assert.equal(orderAfterPickup.status, "PICKED_UP");

    const dropoffResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}/dropoff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(dropoffResponse.status, 200);
    const droppedOff = (await dropoffResponse.json()) as { status: string };
    assert.equal(droppedOff.status, "DROPPED_OFF");

    const orderAfterDropoffResponse = await fetch(`${baseUrl}/api/v1/consumer/orders/${order.id}`);
    assert.equal(orderAfterDropoffResponse.status, 200);
    const orderAfterDropoff = (await orderAfterDropoffResponse.json()) as { status: string };
    assert.equal(orderAfterDropoff.status, "DELIVERED");
  } finally {
    listener.close();
  }
});

test("courier job accept rejects missing courier id payload", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createDispatchPendingOrder(baseUrl);

    const acceptResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(acceptResponse.status, 400);
    const payload = (await acceptResponse.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});

test("courier job routes return 404 for unknown job id", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const acceptResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/unknown/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-x" }),
    });

    assert.equal(acceptResponse.status, 404);
    const payload = (await acceptResponse.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "COURIER_JOB_NOT_FOUND");
  } finally {
    listener.close();
  }
});

test("courier job pickup rejects wrong courier for accepted job", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createDispatchPendingOrder(baseUrl);

    const acceptResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(acceptResponse.status, 200);

    const pickupResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}/pickup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-2" }),
    });
    assert.equal(pickupResponse.status, 409);

    const payload = (await pickupResponse.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "COURIER_JOB_STATE_CONFLICT");
  } finally {
    listener.close();
  }
});

test("courier job dropoff rejects out-of-sequence transition", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createDispatchPendingOrder(baseUrl);

    const dropoffResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}/dropoff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(dropoffResponse.status, 409);

    const payload = (await dropoffResponse.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "COURIER_JOB_STATE_CONFLICT");
  } finally {
    listener.close();
  }
});

test("courier job details route returns current job state", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const order = await createDispatchPendingOrder(baseUrl);

    const acceptResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(acceptResponse.status, 200);

    const detailResponse = await fetch(`${baseUrl}/api/v1/courier/jobs/${order.id}`);
    assert.equal(detailResponse.status, 200);
    const payload = (await detailResponse.json()) as {
      jobId: string;
      orderId: string;
      status: string;
      courierId: string | null;
    };

    assert.equal(payload.jobId, order.id);
    assert.equal(payload.orderId, order.id);
    assert.equal(payload.status, "ACCEPTED");
    assert.equal(payload.courierId, "courier-1");
  } finally {
    listener.close();
  }
});

test("courier jobs route lists jobs for courier and supports status filter", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const acceptedOrder = await createDispatchPendingOrder(baseUrl);
    const pickedUpOrder = await createDispatchPendingOrder(baseUrl);
    await fetch(`${baseUrl}/api/v1/courier/jobs/${acceptedOrder.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    await fetch(`${baseUrl}/api/v1/courier/jobs/${pickedUpOrder.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    await fetch(`${baseUrl}/api/v1/courier/jobs/${pickedUpOrder.id}/pickup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });

    const otherCourierOrder = await createDispatchPendingOrder(baseUrl);
    await fetch(`${baseUrl}/api/v1/courier/jobs/${otherCourierOrder.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-2" }),
    });

    const listResponse = await fetch(`${baseUrl}/api/v1/courier/jobs?courierId=courier-1`);
    assert.equal(listResponse.status, 200);
    const listPayload = (await listResponse.json()) as {
      jobs: Array<{ jobId: string; status: string; courierId: string | null }>;
    };

    const accepted = listPayload.jobs.find((job) => job.jobId === acceptedOrder.id);
    const pickedUp = listPayload.jobs.find((job) => job.jobId === pickedUpOrder.id);
    const otherCourier = listPayload.jobs.find((job) => job.jobId === otherCourierOrder.id);

    assert.ok(accepted);
    assert.equal(accepted?.status, "ACCEPTED");
    assert.ok(pickedUp);
    assert.equal(pickedUp?.status, "PICKED_UP");
    assert.equal(otherCourier, undefined);

    const pickedUpOnlyResponse = await fetch(
      `${baseUrl}/api/v1/courier/jobs?courierId=courier-1&status=PICKED_UP`,
    );
    assert.equal(pickedUpOnlyResponse.status, 200);
    const pickedUpOnlyPayload = (await pickedUpOnlyResponse.json()) as {
      jobs: Array<{ jobId: string; status: string }>;
    };

    assert.equal(pickedUpOnlyPayload.jobs.length, 1);
    assert.equal(pickedUpOnlyPayload.jobs[0]?.jobId, pickedUpOrder.id);
    assert.equal(pickedUpOnlyPayload.jobs[0]?.status, "PICKED_UP");
  } finally {
    listener.close();
  }
});

test("courier jobs route rejects missing courierId query", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/v1/courier/jobs`);
    assert.equal(response.status, 400);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
