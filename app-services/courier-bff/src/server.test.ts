import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import { createAppSessionAuthService, createDevOidcVerifier } from "@fleetfeast/app-auth";

import { createCourierBffServer, createCourierCoreApiDependencies } from "./server.js";

function createTestCourierDependencies(
  listAvailableJobs: () => Promise<Array<{ jobId: string; orderId: string; status: string }>>,
  getFeatureFlagSnapshot: () => Promise<{
    flags: Record<string, boolean>;
    ttlSeconds: number;
    generatedAtEpochMillis: number;
  }> = async () => ({
    flags: {
      "courier.offlineReplay": true,
    },
    ttlSeconds: 30,
    generatedAtEpochMillis: 1_735_680_900_000,
  }),
) {
  return {
    listAvailableJobs,
    getFeatureFlagSnapshot,
    oidcVerifier: createDevOidcVerifier(),
    sessionAuth: createAppSessionAuthService({
      jwtSecret: "fleetfeast-courier-bff-test-secret",
    }),
  };
}

test("courier-bff exchanges OIDC token into courier-scoped app session", async () => {
  const app = createCourierBffServer(createTestCourierDependencies(async () => []));
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
          oidcToken: "dev:courier-user-1:courier-1@fleetfeast.dev:courier",
          traceId: "trace-courier-1",
          deviceId: "courier-device-1",
        }),
      },
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      session: { persona: string; role: string; userId: string };
      tokenPair: { refreshToken: string };
    };

    assert.equal(payload.session.persona, "courier");
    assert.equal(payload.session.role, "courier");
    assert.equal(payload.session.userId, "courier-user-1");
    assert.ok(payload.tokenPair.refreshToken.length > 20);
  } finally {
    await app.close();
  }
});

test("courier-bff refresh endpoint rotates refresh token", async () => {
  const app = createCourierBffServer(createTestCourierDependencies(async () => []));
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind courier-bff test listener");
    }

    const exchange = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/courier/session/exchange`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oidcToken: "dev:courier-user-1:courier-1@fleetfeast.dev:courier",
          traceId: "trace-exchange",
          deviceId: "courier-device-1",
        }),
      },
    );
    assert.equal(exchange.status, 200);

    const exchangePayload = (await exchange.json()) as {
      tokenPair: { refreshToken: string };
    };

    const refresh = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/session/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refreshToken: exchangePayload.tokenPair.refreshToken,
        traceId: "trace-refresh",
        deviceId: "courier-device-1",
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

test("courier-bff returns available jobs", async () => {
  const app = createCourierBffServer(
    createTestCourierDependencies(async () => [
      {
        jobId: "job-1",
        orderId: "order-1",
        status: "AVAILABLE",
      },
    ]),
  );
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

test("courier-bff returns feature-flag snapshot", async () => {
  const app = createCourierBffServer(
    createTestCourierDependencies(
      async () => [],
      async () => ({
        flags: {
          "courier.offlineReplay": true,
          "courier.routeBatching": false,
        },
        ttlSeconds: 60,
        generatedAtEpochMillis: 1_735_680_901_000,
      }),
    ),
  );
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind courier-bff test listener");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/courier/feature-flags?userId=courier-1&role=courier&tenantId=fleet-1`,
    );
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      flags: Record<string, boolean>;
      ttlSeconds: number;
      generatedAtEpochMillis: number;
    };

    assert.equal(payload.flags["courier.offlineReplay"], true);
    assert.equal(payload.flags["courier.routeBatching"], false);
    assert.equal(payload.ttlSeconds, 60);
    assert.equal(payload.generatedAtEpochMillis, 1_735_680_901_000);
  } finally {
    await app.close();
  }
});

test("courier-bff core-api dependency calls backend available jobs endpoint", async () => {
  const requests: Array<{ method: string; url: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
    });

    if (request.method === "GET" && request.url === "/api/v1/courier/jobs/available") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          jobs: [{ jobId: "job-backend-1", orderId: "order-backend-1", status: "AVAILABLE" }],
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
    throw new Error("Failed to bind courier backend stub");
  }

  const app = createCourierBffServer({
    ...createCourierCoreApiDependencies({
      coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
    }),
    oidcVerifier: createDevOidcVerifier(),
    sessionAuth: createAppSessionAuthService({
      jwtSecret: "fleetfeast-courier-bff-test-secret",
    }),
  });
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind courier-bff listener");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/jobs/available`);
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      jobs: Array<{ jobId: string; orderId: string; status: string }>;
    };
    assert.equal(payload.jobs.length, 1);
    assert.equal(payload.jobs[0]?.jobId, "job-backend-1");
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/api/v1/courier/jobs/available");
  } finally {
    await app.close();
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
