import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import {
  AdminAuthSessionManagerError,
  createAdminAuthSessionManager,
} from "./auth-session-manager.js";

test("admin auth session manager stores active session on sign-in", async () => {
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
              role: "system_admin",
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
      throw new Error("Failed to bind admin auth manager test backend");
    }

    const manager = createAdminAuthSessionManager({
      opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
    });

    const session = await manager.signIn({
      oidcToken: "dev:admin-user-1:admin@fleetfeast.dev:system_admin",
      traceId: "trace-1",
      deviceId: "web-admin",
    });

    assert.equal(session.tokenPair.accessToken, "access-1");
    assert.equal(manager.currentSession()?.tokenPair.refreshToken, "refresh-1");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.url, "/app/v1/admin/session/exchange");
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

test("admin auth session manager refreshes using stored refresh token", async () => {
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
              role: "system_admin",
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

      if (request.method === "POST" && request.url === "/app/v1/admin/session/refresh") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            session: {
              sessionId: "session-2",
              userId: "admin-user-1",
              role: "system_admin",
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
      throw new Error("Failed to bind admin auth manager test backend");
    }

    const manager = createAdminAuthSessionManager({
      opsBffBaseUrl: `http://127.0.0.1:${address.port}`,
    });

    await manager.signIn({
      oidcToken: "dev:admin-user-1:admin@fleetfeast.dev:system_admin",
      traceId: "trace-1",
      deviceId: "web-admin",
    });
    const refreshed = await manager.refresh({
      traceId: "trace-2",
      deviceId: "web-admin",
    });

    assert.equal(refreshed.tokenPair.accessToken, "access-2");
    assert.equal(manager.currentSession()?.tokenPair.refreshToken, "refresh-2");
    assert.equal(requests[1]?.method, "POST");
    assert.equal(requests[1]?.url, "/app/v1/admin/session/refresh");
    assert.match(requests[1]?.body ?? "", /"refreshToken":"refresh-1"/);
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

test("admin auth session manager requires existing session for refresh", async () => {
  const manager = createAdminAuthSessionManager();

  await assert.rejects(
    manager.refresh({
      traceId: "trace-no-session",
      deviceId: "web-admin",
    }),
    (error) =>
      error instanceof AdminAuthSessionManagerError &&
      error.message.includes("No active session to refresh"),
  );
});
