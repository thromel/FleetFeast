import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import {
  exchangeAdminSession,
  fetchAdminFeatureFlags,
  fetchAdminIncidents,
  refreshAdminSession,
} from "./api.js";

test("fetchAdminIncidents calls ops-bff admin incidents endpoint", async () => {
  const requests: Array<{ method: string; url: string; authorization?: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
      authorization: request.headers.authorization,
    });

    if (request.method === "GET" && request.url === "/app/v1/admin/incidents") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ incidents: [{ id: "incident-77", severity: "HIGH" }] }));
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind admin test backend");
    }

    const incidents = await fetchAdminIncidents({
      opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      appSessionToken: "session-token-1",
    });

    assert.equal(incidents.length, 1);
    assert.equal(incidents[0]?.id, "incident-77");
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/app/v1/admin/incidents");
    assert.equal(requests[0]?.authorization, "Bearer session-token-1");
  } finally {
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

test("fetchAdminFeatureFlags calls ops-bff admin feature-flags endpoint", async () => {
  const requests: Array<{ method: string; url: string; authorization?: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
      authorization: request.headers.authorization,
    });

    if (
      request.method === "GET" &&
      request.url ===
        "/app/v1/admin/feature-flags?userId=admin-user-1&role=system_admin&tenantId=metro-1"
    ) {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          flags: {
            "admin.incidentWorkbenchV2": false,
          },
          ttlSeconds: 120,
          generatedAtEpochMillis: 1700000000000,
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind admin feature-flags test backend");
    }

    const snapshot = await fetchAdminFeatureFlags(
      {
        userId: "admin-user-1",
        role: "system_admin",
        tenantId: "metro-1",
      },
      {
        opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
        appSessionToken: "session-token-1",
      },
    );

    assert.equal(snapshot.flags["admin.incidentWorkbenchV2"], false);
    assert.equal(snapshot.ttlSeconds, 120);
    assert.equal(snapshot.generatedAtEpochMillis, 1700000000000);
    assert.equal(requests[0]?.method, "GET");
    assert.equal(
      requests[0]?.url,
      "/app/v1/admin/feature-flags?userId=admin-user-1&role=system_admin&tenantId=metro-1",
    );
    assert.equal(requests[0]?.authorization, "Bearer session-token-1");
  } finally {
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

test("exchangeAdminSession posts to ops-bff session exchange endpoint", async () => {
  const requests: Array<{ method: string; url: string; body: string }> = [];
  const backend = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body: Buffer.concat(chunks).toString("utf8"),
      });

      if (request.method === "POST" && request.url === "/app/v1/admin/session/exchange") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            session: {
              sessionId: "session-1",
              userId: "admin-user-1",
              role: "admin",
              persona: "admin",
              traceId: "trace-1",
              refreshTokenId: "rt-1",
              issuedAt: "2026-02-19T00:00:00Z",
              expiresAt: "2026-02-19T01:00:00Z",
            },
            tokenPair: {
              tokenType: "Bearer",
              accessToken: "access-1",
              refreshToken: "refresh-1",
              expiresInSeconds: 3600,
              refreshExpiresInSeconds: 2592000,
              refreshExpiresAt: "2026-03-21T00:00:00Z",
            },
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.end();
    });
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind admin test backend");
    }

    const sessionExchange = await exchangeAdminSession(
      {
        oidcToken: "dev:admin-user-1:admin@fleetfeast.dev:admin",
        traceId: "trace-1",
        deviceId: "web-admin",
      },
      {
        opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(sessionExchange.tokenPair.accessToken, "access-1");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/admin/session/exchange");
    assert.match(requests[0]?.body ?? "", /"oidcToken":"dev:admin-user-1:admin@fleetfeast\.dev:admin"/);
    assert.match(requests[0]?.body ?? "", /"traceId":"trace-1"/);
  } finally {
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

test("refreshAdminSession posts to ops-bff session refresh endpoint", async () => {
  const requests: Array<{ method: string; url: string; body: string }> = [];
  const backend = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body: Buffer.concat(chunks).toString("utf8"),
      });

      if (request.method === "POST" && request.url === "/app/v1/admin/session/refresh") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            session: {
              sessionId: "session-2",
              userId: "admin-user-1",
              role: "admin",
              persona: "admin",
              traceId: "trace-2",
              refreshTokenId: "rt-2",
              issuedAt: "2026-02-19T01:00:00Z",
              expiresAt: "2026-02-19T02:00:00Z",
            },
            tokenPair: {
              tokenType: "Bearer",
              accessToken: "access-2",
              refreshToken: "refresh-2",
              expiresInSeconds: 3600,
              refreshExpiresInSeconds: 2592000,
              refreshExpiresAt: "2026-03-21T01:00:00Z",
            },
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.end();
    });
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind admin test backend");
    }

    const refreshedSession = await refreshAdminSession(
      {
        refreshToken: "refresh-1",
        traceId: "trace-2",
        deviceId: "web-admin",
      },
      {
        opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(refreshedSession.tokenPair.accessToken, "access-2");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/admin/session/refresh");
    assert.match(requests[0]?.body ?? "", /"refreshToken":"refresh-1"/);
    assert.match(requests[0]?.body ?? "", /"traceId":"trace-2"/);
  } finally {
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
