import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

test("POST /api/v1/identity/register returns 201 for new user", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/identity/register`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "route@example.com",
          phone: "+15555550105",
          passwordHash: "hash-1",
          role: "consumer",
        }),
      },
    );

    assert.equal(response.status, 201);
    const payload = (await response.json()) as { id: string; email: string };
    assert.equal(payload.email, "route@example.com");
    assert.ok(payload.id.length > 0);
  } finally {
    listener.close();
  }
});

test("POST /api/v1/identity/register returns 409 for duplicate email", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const url = `http://127.0.0.1:${address.port}/api/v1/identity/register`;

    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "dup-route@example.com",
        phone: "+15555550106",
        passwordHash: "hash-1",
        role: "consumer",
      }),
    });

    const duplicate = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "dup-route@example.com",
        phone: "+15555550107",
        passwordHash: "hash-2",
        role: "consumer",
      }),
    });

    assert.equal(duplicate.status, 409);
    const payload = (await duplicate.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "IDENTITY_EMAIL_EXISTS");
  } finally {
    listener.close();
  }
});
