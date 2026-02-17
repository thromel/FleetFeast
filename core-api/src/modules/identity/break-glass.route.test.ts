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

test("system admin can activate break-glass flow with mandatory reason and audit log", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const adminToken = await registerAndLogin(
      baseUrl,
      "breakglass-admin@example.com",
      "+15555550140",
      "system_admin",
      "123456",
    );

    const activation = await fetch(`${baseUrl}/api/v1/admin/break-glass/activate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reasonCode: "INCIDENT_RESPONSE",
        justification: "Emergency access for payment outage mitigation",
      }),
    });

    assert.equal(activation.status, 201);
    const payload = (await activation.json()) as {
      activationId: string;
      reasonCode: string;
      status: string;
    };

    assert.ok(payload.activationId.length > 0);
    assert.equal(payload.reasonCode, "INCIDENT_RESPONSE");
    assert.equal(payload.status, "ACTIVE");

    const auditResponse = await fetch(`${baseUrl}/internal/risk/compliance/audit/events`);
    assert.equal(auditResponse.status, 200);
    const auditPayload = (await auditResponse.json()) as {
      events: Array<{ actionType: string; reasonCode: string }>;
    };

    const breakGlassEvent = auditPayload.events.find(
      (event) => event.actionType === "ADMIN_BREAK_GLASS",
    );
    assert.ok(breakGlassEvent);
    assert.equal(breakGlassEvent?.reasonCode, "INCIDENT_RESPONSE");
  } finally {
    listener.close();
  }
});

test("non-admin actor cannot activate break-glass flow", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const consumerToken = await registerAndLogin(
      baseUrl,
      "breakglass-consumer@example.com",
      "+15555550141",
      "consumer",
    );

    const activation = await fetch(`${baseUrl}/api/v1/admin/break-glass/activate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${consumerToken}`,
      },
      body: JSON.stringify({
        reasonCode: "INCIDENT_RESPONSE",
        justification: "Attempting unauthorized elevation",
      }),
    });

    assert.equal(activation.status, 403);
    const payload = (await activation.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "IDENTITY_PERMISSION_DENIED");
  } finally {
    listener.close();
  }
});

test("break-glass activation rejects missing reason code", async () => {
  const app = createServer();
  const listener = app.listen(0);

  try {
    const address = listener.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test listener");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const adminToken = await registerAndLogin(
      baseUrl,
      "breakglass-admin2@example.com",
      "+15555550142",
      "system_admin",
      "123456",
    );

    const activation = await fetch(`${baseUrl}/api/v1/admin/break-glass/activate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        justification: "Missing reason code should fail",
      }),
    });

    assert.equal(activation.status, 400);
    const payload = (await activation.json()) as { errorCode: string };
    assert.equal(payload.errorCode, "INVALID_REQUEST");
  } finally {
    listener.close();
  }
});
