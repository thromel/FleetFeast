import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal support SLA evaluation route escalates overdue tickets", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const ticketResponse = await fetch(`${baseUrl}/api/v1/support/tickets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order-1",
        actorId: "consumer-1",
        issueType: "PAYMENT_ISSUE",
        summary: "Payment still pending",
      }),
    });
    assert.equal(ticketResponse.status, 201);

    const evaluatedAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const evaluationResponse = await fetch(`${baseUrl}/internal/support/sla/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        evaluatedAt,
      }),
    });

    assert.equal(evaluationResponse.status, 200);
    const payload = (await evaluationResponse.json()) as { escalatedCount: number };
    assert.equal(payload.escalatedCount, 1);
  } finally {
    listener.close();
  }
});
