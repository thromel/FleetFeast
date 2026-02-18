import assert from "node:assert/strict";
import test from "node:test";

import { createCourierBffServer } from "./server.js";

test("courier-bff exchanges OIDC token into courier-scoped app session", async () => {
  const app = createCourierBffServer({
    listAvailableJobs: async () => [],
  });
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind courier-bff test listener");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/courier/session/exchange`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oidcToken: "oidc-token-courier",
          userId: "courier-user-1",
          traceId: "trace-courier-1",
        }),
      },
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      session: { persona: string; role: string };
    };

    assert.equal(payload.session.persona, "courier");
    assert.equal(payload.session.role, "courier");
  } finally {
    await app.close();
  }
});

test("courier-bff returns available jobs", async () => {
  const app = createCourierBffServer({
    listAvailableJobs: async () => [
      {
        jobId: "job-1",
        orderId: "order-1",
        status: "AVAILABLE",
      },
    ],
  });
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind courier-bff test listener");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/jobs/available`);
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      jobs: Array<{ jobId: string; orderId: string; status: string }>;
    };

    assert.equal(payload.jobs.length, 1);
    assert.equal(payload.jobs[0]?.jobId, "job-1");
  } finally {
    await app.close();
  }
});
