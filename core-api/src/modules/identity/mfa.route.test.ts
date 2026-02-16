import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function registerUser(
  baseUrl: string,
  email: string,
  phone: string,
  role: string,
  passwordHash = "pw-hash",
) {
  const response = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, phone, passwordHash, role }),
  });

  assert.equal(response.status, 201);
}

test("consumer login succeeds without MFA", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await registerUser(baseUrl, "mfa-consumer@example.com", "+15555550130", "consumer");

    const login = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "mfa-consumer@example.com",
        passwordHash: "pw-hash",
      }),
    });

    assert.equal(login.status, 200);
  } finally {
    listener.close();
  }
});

test("system_admin login requires MFA", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await registerUser(baseUrl, "mfa-admin@example.com", "+15555550131", "system_admin");

    const login = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "mfa-admin@example.com",
        passwordHash: "pw-hash",
      }),
    });

    assert.equal(login.status, 401);
    const payload = (await login.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "IDENTITY_MFA_REQUIRED");
  } finally {
    listener.close();
  }
});

test("POST /api/v1/identity/mfa/verify returns tokens for privileged user", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    await registerUser(baseUrl, "mfa-verify@example.com", "+15555550132", "system_admin");

    const verify = await fetch(`${baseUrl}/api/v1/identity/mfa/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "mfa-verify@example.com",
        passwordHash: "pw-hash",
        mfaCode: "123456",
      }),
    });

    assert.equal(verify.status, 200);
    const payload = (await verify.json()) as { accessToken: string; refreshToken: string };
    assert.ok(payload.accessToken.split(".").length === 3);
    assert.ok(payload.refreshToken.length > 20);
  } finally {
    listener.close();
  }
});
