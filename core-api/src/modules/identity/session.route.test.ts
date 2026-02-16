import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function registerUser(baseUrl: string, email: string, phone: string, passwordHash: string) {
  const response = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, phone, passwordHash, role: "consumer" }),
  });

  assert.equal(response.status, 201);
}

test("POST /api/v1/identity/login issues session tokens", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await registerUser(baseUrl, "login@example.com", "+15555550113", "pw-hash");

    const response = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "login@example.com", passwordHash: "pw-hash" }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { accessToken: string; refreshToken: string };
    assert.ok(payload.accessToken.split(".").length === 3);
    assert.ok(payload.refreshToken.length > 20);
  } finally {
    listener.close();
  }
});

test("POST /api/v1/identity/token/refresh rotates refresh token and detects replay", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await registerUser(baseUrl, "rotate@example.com", "+15555550114", "pw-hash");

    const login = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "rotate@example.com", passwordHash: "pw-hash" }),
    });

    const session = (await login.json()) as { refreshToken: string };

    const refresh = await fetch(`${baseUrl}/api/v1/identity/token/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    assert.equal(refresh.status, 200);

    const replay = await fetch(`${baseUrl}/api/v1/identity/token/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    assert.equal(replay.status, 401);
    const payload = (await replay.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "IDENTITY_REFRESH_REPLAY_DETECTED");
  } finally {
    listener.close();
  }
});
