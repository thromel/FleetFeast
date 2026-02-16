import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("internal template resolver route returns localized template", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/notifications/templates/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "order.created.v1",
        actorType: "consumer",
        locale: "en-US",
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      templateKey: string;
      localeUsed: string;
      localizationWarning: boolean;
    };
    assert.equal(payload.templateKey, "order.created.consumer.v1");
    assert.equal(payload.localeUsed, "en-US");
    assert.equal(payload.localizationWarning, false);
  } finally {
    listener.close();
  }
});

test("internal template resolver route falls back to default locale", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/internal/notifications/templates/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "dispatch.assignment.completed.v1",
        actorType: "courier",
        locale: "fr-FR",
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      templateKey: string;
      localeUsed: string;
      localizationWarning: boolean;
    };
    assert.equal(payload.templateKey, "dispatch.assignment.completed.courier.v1");
    assert.equal(payload.localeUsed, "en-US");
    assert.equal(payload.localizationWarning, true);
  } finally {
    listener.close();
  }
});
