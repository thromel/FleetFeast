import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("courier telemetry route accepts in-order updates and computes ETA", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/api/v1/courier/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courierId: "courier-telemetry-1",
        observedAtEpochMs: 1000,
        speedMps: 6.5,
        distanceToDropoffMeters: 650,
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      accepted: boolean;
      dropReason: string;
      etaSeconds: number;
    };

    assert.equal(payload.accepted, true);
    assert.equal(payload.dropReason, "");
    assert.ok(payload.etaSeconds > 0);
  } finally {
    listener.close();
  }
});

test("courier telemetry route rejects out-of-order updates", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const first = await fetch(`${baseUrl}/api/v1/courier/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courierId: "courier-telemetry-2",
        observedAtEpochMs: 1500,
        speedMps: 5.0,
        distanceToDropoffMeters: 900,
      }),
    });
    assert.equal(first.status, 200);

    const second = await fetch(`${baseUrl}/api/v1/courier/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courierId: "courier-telemetry-2",
        observedAtEpochMs: 1400,
        speedMps: 7.0,
        distanceToDropoffMeters: 700,
      }),
    });
    assert.equal(second.status, 200);

    const payload = (await second.json()) as {
      accepted: boolean;
      dropReason: string;
      etaSeconds: number;
    };

    assert.equal(payload.accepted, false);
    assert.equal(payload.dropReason, "OUT_OF_ORDER");
    assert.equal(payload.etaSeconds, 0);
  } finally {
    listener.close();
  }
});

test("courier telemetry route validates payload", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/api/v1/courier/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courierId: "",
        observedAtEpochMs: "invalid",
      }),
    });

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
