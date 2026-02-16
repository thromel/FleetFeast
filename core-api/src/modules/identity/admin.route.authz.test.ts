import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../../server.js";

async function registerAndLogin(
  baseUrl: string,
  email: string,
  phone: string,
  role: string,
  mfaCode?: string,
): Promise<string> {
  const passwordHash = "pw-hash";

  const register = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, phone, passwordHash, role }),
  });
  assert.equal(register.status, 201);

  const login = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, passwordHash, mfaCode }),
  });
  assert.equal(login.status, 200);

  const tokens = (await login.json()) as { accessToken: string };
  return tokens.accessToken;
}

test("GET /api/v1/admin/health returns 403 for consumer token", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const token = await registerAndLogin(
      baseUrl,
      "consumer-authz@example.com",
      "+15555550120",
      "consumer",
    );

    const response = await fetch(`${baseUrl}/api/v1/admin/health`, {
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 403);
    const payload = (await response.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "IDENTITY_PERMISSION_DENIED");
  } finally {
    listener.close();
  }
});

test("GET /api/v1/admin/health returns 200 for system_admin token", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const token = await registerAndLogin(
      baseUrl,
      "admin-authz@example.com",
      "+15555550121",
      "system_admin",
      "123456",
    );

    const response = await fetch(`${baseUrl}/api/v1/admin/health`, {
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { status: string; scope: string };
    assert.equal(payload.status, "ok");
    assert.equal(payload.scope, "admin");
  } finally {
    listener.close();
  }
});
