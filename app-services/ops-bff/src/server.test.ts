import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import { createAppSessionAuthService, createDevOidcVerifier } from "@fleetfeast/app-auth";

import {
  createOpsBffServer,
  createOpsCoreApiDependencies,
  type OpsBffDependencies,
} from "./server.js";

function createTestOpsDependencies(): OpsBffDependencies {
  return {
    listMerchantOrders: async () => [{ id: "order-1", status: "MERCHANT_ACCEPTED" }],
    listMerchantPayoutStatements: async () => [
      {
        statementId: "stmt-1",
        payoutBatchId: "batch-1",
        entityType: "MERCHANT",
        entityId: "merchant-1",
        periodStart: "2026-02-01T00:00:00.000Z",
        periodEnd: "2026-02-07T23:59:59.999Z",
        currency: "USD",
        totalAmount: 18250,
        lineItems: [
          {
            label: "Net payout",
            amount: 18250,
          },
        ],
        format: "PDF",
        renderedContent: "statement-content",
        createdAt: "2026-02-08T03:00:00.000Z",
      },
    ],
    listAdminIncidents: async () => [{ id: "incident-1", severity: "HIGH" }],
    listAdminComplianceAuditEvents: async () => [
      {
        auditEventId: "audit-1",
        actionType: "PAYOUT_RELEASED",
        actorId: "finance-ops-1",
        targetType: "PAYOUT_BATCH",
        targetId: "batch-1",
        reasonCode: "SCHEDULED_RELEASE",
        metadata: {
          payoutBatchId: "batch-1",
        },
        timestamp: "2026-02-20T00:00:00.000Z",
        previousHash: "genesis",
        hash: "hash-1",
      },
    ],
    getAdminSloDashboard: async () => ({
      availabilityPercent: 99.7,
      checkoutP95Ms: 810,
      timelineP95Ms: 430,
      breaches: [
        {
          type: "LATENCY_CHECKOUT",
          actual: 810,
          threshold: 700,
        },
      ],
    }),
    getMerchantFeatureFlagSnapshot: async () => ({
      flags: {
        "merchant.livePrepBoard": true,
      },
      ttlSeconds: 30,
      generatedAtEpochMillis: 1_735_681_600_000,
    }),
    getAdminFeatureFlagSnapshot: async () => ({
      flags: {
        "admin.incidentWorkbenchV2": false,
      },
      ttlSeconds: 30,
      generatedAtEpochMillis: 1_735_681_600_000,
    }),
    oidcVerifier: createDevOidcVerifier(),
    sessionAuth: createAppSessionAuthService({
      jwtSecret: "fleetfeast-ops-bff-test-secret",
    }),
  };
}

test("ops-bff exchanges merchant and admin sessions with persona role boundaries", async () => {
  const app = createOpsBffServer(createTestOpsDependencies());
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff test listener");
    }

    const merchantExchange = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/session/exchange`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oidcToken: "dev:merchant-user-1:merchant-1@fleetfeast.dev:merchant_operator",
          traceId: "trace-merchant-1",
        }),
      },
    );

    assert.equal(merchantExchange.status, 200);
    const merchantPayload = (await merchantExchange.json()) as {
      session: { persona: string; role: string };
    };
    assert.equal(merchantPayload.session.persona, "merchant");
    assert.equal(merchantPayload.session.role, "merchant_operator");

    const adminExchange = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/admin/session/exchange`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oidcToken: "dev:admin-user-1:admin-1@fleetfeast.dev:system_admin",
          traceId: "trace-admin-1",
        }),
      },
    );

    assert.equal(adminExchange.status, 200);
    const adminPayload = (await adminExchange.json()) as {
      session: { persona: string; role: string };
    };
    assert.equal(adminPayload.session.persona, "admin");
    assert.equal(adminPayload.session.role, "system_admin");

    const forbiddenMerchant = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/session/exchange`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oidcToken: "dev:wrong-user:wrong@fleetfeast.dev:consumer",
          traceId: "trace-merchant-forbidden",
        }),
      },
    );

    assert.equal(forbiddenMerchant.status, 403);
    const forbiddenPayload = (await forbiddenMerchant.json()) as { errorCode: string };
    assert.equal(forbiddenPayload.errorCode, "MERCHANT_ROLE_REQUIRED");
  } finally {
    await app.close();
  }
});

test("ops-bff refresh endpoint rotates admin refresh token", async () => {
  const app = createOpsBffServer(createTestOpsDependencies());
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff test listener");
    }

    const exchange = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/session/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        oidcToken: "dev:admin-user-2:admin-2@fleetfeast.dev:support_agent",
        traceId: "trace-exchange",
      }),
    });

    assert.equal(exchange.status, 200);
    const exchangePayload = (await exchange.json()) as {
      tokenPair: { refreshToken: string };
    };

    const refresh = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/session/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refreshToken: exchangePayload.tokenPair.refreshToken,
        traceId: "trace-refresh",
      }),
    });

    assert.equal(refresh.status, 200);
    const refreshPayload = (await refresh.json()) as {
      tokenPair: { refreshToken: string };
    };

    assert.notEqual(refreshPayload.tokenPair.refreshToken, exchangePayload.tokenPair.refreshToken);
  } finally {
    await app.close();
  }
});

test("ops-bff requires persona-scoped access token for merchant/admin data routes", async () => {
  const app = createOpsBffServer(createTestOpsDependencies());
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff test listener");
    }

    const merchantNoAuth = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-1`,
    );
    assert.equal(merchantNoAuth.status, 401);
    const merchantNoAuthPayload = (await merchantNoAuth.json()) as { errorCode: string };
    assert.equal(merchantNoAuthPayload.errorCode, "APP_ACCESS_TOKEN_REQUIRED");

    const merchantExchange = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/session/exchange`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oidcToken: "dev:merchant-user-1:merchant-1@fleetfeast.dev:merchant_operator",
          traceId: "trace-merchant-authz",
        }),
      },
    );
    assert.equal(merchantExchange.status, 200);
    const merchantSession = (await merchantExchange.json()) as {
      tokenPair: { accessToken: string };
    };

    const merchantWithAuth = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-1`,
      {
        headers: { authorization: `Bearer ${merchantSession.tokenPair.accessToken}` },
      },
    );
    assert.equal(merchantWithAuth.status, 200);

    const adminWithMerchantToken = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/admin/incidents`,
      {
        headers: { authorization: `Bearer ${merchantSession.tokenPair.accessToken}` },
      },
    );
    assert.equal(adminWithMerchantToken.status, 403);
    const adminWithMerchantTokenPayload = (await adminWithMerchantToken.json()) as {
      errorCode: string;
    };
    assert.equal(adminWithMerchantTokenPayload.errorCode, "APP_ROUTE_FORBIDDEN");

    const adminExchange = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/admin/session/exchange`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oidcToken: "dev:admin-user-1:admin-1@fleetfeast.dev:system_admin",
          traceId: "trace-admin-authz",
        }),
      },
    );
    assert.equal(adminExchange.status, 200);
    const adminSession = (await adminExchange.json()) as {
      tokenPair: { accessToken: string };
    };

    const adminWithAuth = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/incidents`, {
      headers: { authorization: `Bearer ${adminSession.tokenPair.accessToken}` },
    });
    assert.equal(adminWithAuth.status, 200);

    const adminAuditNoAuth = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/admin/compliance/audit-events`,
    );
    assert.equal(adminAuditNoAuth.status, 401);
  } finally {
    await app.close();
  }
});

test("ops-bff serves merchant orders, merchant payouts, admin incidents, admin slo dashboard, and admin audit events", async () => {
  const dependencies = createTestOpsDependencies();
  const merchantToken = (
    await dependencies.sessionAuth.issueSession({
      userId: "merchant-1",
      role: "merchant_operator",
      persona: "merchant",
      traceId: "trace-merchant-data",
    })
  ).tokenPair.accessToken;
  const adminToken = (
    await dependencies.sessionAuth.issueSession({
      userId: "admin-1",
      role: "system_admin",
      persona: "admin",
      traceId: "trace-admin-data",
    })
  ).tokenPair.accessToken;
  const app = createOpsBffServer(dependencies);
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff test listener");
    }

    const merchantResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-1`,
      {
        headers: { authorization: `Bearer ${merchantToken}` },
      },
    );
    assert.equal(merchantResponse.status, 200);
    const merchantPayload = (await merchantResponse.json()) as {
      orders: Array<{ id: string }>;
    };
    assert.equal(merchantPayload.orders[0]?.id, "order-1");

    const payoutsResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/payouts?merchantId=merchant-1`,
      {
        headers: { authorization: `Bearer ${merchantToken}` },
      },
    );
    assert.equal(payoutsResponse.status, 200);
    const payoutsPayload = (await payoutsResponse.json()) as {
      statements: Array<{ statementId: string; totalAmount: number }>;
    };
    assert.equal(payoutsPayload.statements[0]?.statementId, "stmt-1");
    assert.equal(payoutsPayload.statements[0]?.totalAmount, 18250);

    const adminResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/incidents`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminResponse.status, 200);
    const adminPayload = (await adminResponse.json()) as {
      incidents: Array<{ id: string }>;
    };
    assert.equal(adminPayload.incidents[0]?.id, "incident-1");

    const sloResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/slo-dashboard`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(sloResponse.status, 200);
    const sloPayload = (await sloResponse.json()) as {
      availabilityPercent: number;
      checkoutP95Ms: number;
      timelineP95Ms: number;
      breaches: Array<{ type: string }>;
    };
    assert.equal(sloPayload.availabilityPercent, 99.7);
    assert.equal(sloPayload.checkoutP95Ms, 810);
    assert.equal(sloPayload.breaches[0]?.type, "LATENCY_CHECKOUT");

    const auditResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/admin/compliance/audit-events`,
      {
        headers: { authorization: `Bearer ${adminToken}` },
      },
    );
    assert.equal(auditResponse.status, 200);
    const auditPayload = (await auditResponse.json()) as {
      events: Array<{ auditEventId: string; actionType: string }>;
    };
    assert.equal(auditPayload.events[0]?.auditEventId, "audit-1");
    assert.equal(auditPayload.events[0]?.actionType, "PAYOUT_RELEASED");
  } finally {
    await app.close();
  }
});

test("ops-bff returns merchant and admin feature-flag snapshots", async () => {
  const dependencies = createTestOpsDependencies();
  const merchantToken = (
    await dependencies.sessionAuth.issueSession({
      userId: "merchant-1",
      role: "merchant_operator",
      persona: "merchant",
      traceId: "trace-merchant-flags",
    })
  ).tokenPair.accessToken;
  const adminToken = (
    await dependencies.sessionAuth.issueSession({
      userId: "admin-1",
      role: "system_admin",
      persona: "admin",
      traceId: "trace-admin-flags",
    })
  ).tokenPair.accessToken;
  const app = createOpsBffServer(dependencies);
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff test listener");
    }

    const merchantResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/feature-flags?userId=merchant-1&role=merchant_operator&tenantId=metro-1`,
      {
        headers: { authorization: `Bearer ${merchantToken}` },
      },
    );
    assert.equal(merchantResponse.status, 200);
    const merchantPayload = (await merchantResponse.json()) as {
      flags: Record<string, boolean>;
      ttlSeconds: number;
      generatedAtEpochMillis: number;
    };
    assert.equal(merchantPayload.flags["merchant.livePrepBoard"], true);
    assert.equal(merchantPayload.ttlSeconds, 30);

    const adminResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/admin/feature-flags?userId=admin-1&role=system_admin&tenantId=metro-1`,
      {
        headers: { authorization: `Bearer ${adminToken}` },
      },
    );
    assert.equal(adminResponse.status, 200);
    const adminPayload = (await adminResponse.json()) as {
      flags: Record<string, boolean>;
      ttlSeconds: number;
      generatedAtEpochMillis: number;
    };
    assert.equal(adminPayload.flags["admin.incidentWorkbenchV2"], false);
    assert.equal(adminPayload.ttlSeconds, 30);
  } finally {
    await app.close();
  }
});

test("ops-bff core-api dependency calls merchant and observability/compliance endpoints", async () => {
  const requests: Array<{ method: string; url: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
    });

    if (request.method === "GET" && request.url === "/api/v1/merchant/orders?merchantId=merchant-2") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ orders: [{ id: "order-backend-2", status: "READY" }] }));
      return;
    }

    if (request.method === "GET" && request.url === "/api/v1/merchant/payouts?merchantId=merchant-2") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          statements: [
            {
              statementId: "stmt-backend-2",
              payoutBatchId: "batch-backend-2",
              entityType: "MERCHANT",
              entityId: "merchant-2",
              periodStart: "2026-02-01T00:00:00.000Z",
              periodEnd: "2026-02-07T23:59:59.999Z",
              currency: "USD",
              totalAmount: 22400,
              lineItems: [
                {
                  label: "Net payout",
                  amount: 22400,
                },
              ],
              format: "PDF",
              renderedContent: "backend-statement",
              createdAt: "2026-02-08T03:00:00.000Z",
            },
          ],
        }),
      );
      return;
    }

    if (request.method === "GET" && request.url === "/internal/observability/logs") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          logs: [
            {
              traceId: "trace-incident-1",
              statusCode: 503,
            },
          ],
        }),
      );
      return;
    }

    if (request.method === "GET" && request.url === "/internal/observability/slo/dashboard") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          availabilityPercent: 99.8,
          checkoutP95Ms: 720,
          timelineP95Ms: 440,
          breaches: [],
        }),
      );
      return;
    }

    if (request.method === "GET" && request.url === "/internal/risk/compliance/audit/events") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          events: [
            {
              auditEventId: "audit-backend-1",
              actionType: "REFUND_APPROVED",
              actorId: "support-1",
              targetType: "REFUND",
              targetId: "refund-1",
              reasonCode: "DISPUTE_RESOLVED",
              metadata: {
                ticketId: "ticket-1",
              },
              timestamp: "2026-02-20T01:00:00.000Z",
              previousHash: "hash-0",
              hash: "hash-1",
            },
          ],
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve, reject) => {
    backend.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const backendAddress = backend.address();
  if (!backendAddress || typeof backendAddress === "string") {
    throw new Error("Failed to bind ops backend stub");
  }

  const sessionAuth = createAppSessionAuthService({
    jwtSecret: "fleetfeast-ops-bff-test-secret",
  });
  const merchantToken = (
    await sessionAuth.issueSession({
      userId: "merchant-2",
      role: "merchant_operator",
      persona: "merchant",
      traceId: "trace-merchant-core",
    })
  ).tokenPair.accessToken;
  const adminToken = (
    await sessionAuth.issueSession({
      userId: "admin-2",
      role: "system_admin",
      persona: "admin",
      traceId: "trace-admin-core",
    })
  ).tokenPair.accessToken;
  const appWithAuth = createOpsBffServer({
    ...createOpsCoreApiDependencies({
      coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
    }),
    oidcVerifier: createDevOidcVerifier(),
    sessionAuth,
  });
  await appWithAuth.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = appWithAuth.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff listener");
    }

    const merchantResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-2`,
      {
        headers: { authorization: `Bearer ${merchantToken}` },
      },
    );
    assert.equal(merchantResponse.status, 200);
    const merchantPayload = (await merchantResponse.json()) as {
      orders: Array<{ id: string }>;
    };
    assert.equal(merchantPayload.orders[0]?.id, "order-backend-2");

    const payoutsResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/payouts?merchantId=merchant-2`,
      {
        headers: { authorization: `Bearer ${merchantToken}` },
      },
    );
    assert.equal(payoutsResponse.status, 200);
    const payoutsPayload = (await payoutsResponse.json()) as {
      statements: Array<{ statementId: string; totalAmount: number }>;
    };
    assert.equal(payoutsPayload.statements[0]?.statementId, "stmt-backend-2");
    assert.equal(payoutsPayload.statements[0]?.totalAmount, 22400);

    const adminResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/incidents`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminResponse.status, 200);
    const adminPayload = (await adminResponse.json()) as {
      incidents: Array<{ id: string; severity: string }>;
    };
    assert.equal(adminPayload.incidents[0]?.id, "trace-incident-1");
    assert.equal(adminPayload.incidents[0]?.severity, "HIGH");

    const sloResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/slo-dashboard`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(sloResponse.status, 200);
    const sloPayload = (await sloResponse.json()) as {
      availabilityPercent: number;
      checkoutP95Ms: number;
      timelineP95Ms: number;
      breaches: unknown[];
    };
    assert.equal(sloPayload.availabilityPercent, 99.8);
    assert.equal(sloPayload.checkoutP95Ms, 720);
    assert.equal(sloPayload.timelineP95Ms, 440);

    const auditResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/admin/compliance/audit-events`,
      {
        headers: { authorization: `Bearer ${adminToken}` },
      },
    );
    assert.equal(auditResponse.status, 200);
    const auditPayload = (await auditResponse.json()) as {
      events: Array<{ auditEventId: string; actionType: string }>;
    };
    assert.equal(auditPayload.events[0]?.auditEventId, "audit-backend-1");
    assert.equal(auditPayload.events[0]?.actionType, "REFUND_APPROVED");

    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/api/v1/merchant/orders?merchantId=merchant-2");
    assert.equal(requests[1]?.method, "GET");
    assert.equal(requests[1]?.url, "/api/v1/merchant/payouts?merchantId=merchant-2");
    assert.equal(requests[2]?.method, "GET");
    assert.equal(requests[2]?.url, "/internal/observability/logs");
    assert.equal(requests[3]?.method, "GET");
    assert.equal(requests[3]?.url, "/internal/observability/slo/dashboard");
    assert.equal(requests[4]?.method, "GET");
    assert.equal(requests[4]?.url, "/internal/risk/compliance/audit/events");
  } finally {
    await appWithAuth.close();
    await new Promise<void>((resolve, reject) => {
      backend.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
