import assert from "node:assert/strict";
import test from "node:test";

import {
  AppAuthError,
  InMemoryRefreshSessionStore,
  createAppSessionAuthService,
  createDevOidcVerifier,
} from "./index.js";

test("createDevOidcVerifier parses subject and roles", async () => {
  const verifier = createDevOidcVerifier();
  const identity = await verifier.verifyIdToken("dev:user-1:user-1@fleetfeast.dev:consumer,courier");

  assert.equal(identity.subject, "user-1");
  assert.equal(identity.email, "user-1@fleetfeast.dev");
  assert.deepEqual(identity.claims.roles, ["consumer", "courier"]);
});

test("app session auth issues and refreshes tokens", async () => {
  const auth = createAppSessionAuthService({
    jwtSecret: "fleetfeast-auth-test-secret",
  });

  const first = await auth.issueSession({
    userId: "user-1",
    role: "consumer",
    persona: "consumer",
    traceId: "trace-first",
  });

  assert.equal(first.session.userId, "user-1");
  assert.ok(first.tokenPair.accessToken.length > 20);
  assert.ok(first.tokenPair.refreshToken.length > 20);

  const second = await auth.refreshSession({
    refreshToken: first.tokenPair.refreshToken,
    traceId: "trace-refresh",
  });

  assert.notEqual(second.tokenPair.refreshToken, first.tokenPair.refreshToken);
  assert.equal(second.session.persona, "consumer");

  const claims = await auth.verifyAccessToken(second.tokenPair.accessToken);
  assert.equal(claims.userId, "user-1");
  assert.equal(claims.persona, "consumer");
});

test("refresh replay revokes token family", async () => {
  const refreshStore = new InMemoryRefreshSessionStore();
  const auth = createAppSessionAuthService({
    jwtSecret: "fleetfeast-auth-test-secret",
    refreshSessionStore: refreshStore,
  });

  const first = await auth.issueSession({
    userId: "user-2",
    role: "courier",
    persona: "courier",
    traceId: "trace-initial",
  });

  const rotated = await auth.refreshSession({
    refreshToken: first.tokenPair.refreshToken,
    traceId: "trace-rotated",
  });
  assert.ok(rotated.tokenPair.refreshToken.length > 20);

  await assert.rejects(
    auth.refreshSession({
      refreshToken: first.tokenPair.refreshToken,
      traceId: "trace-replay",
    }),
    (error) => error instanceof AppAuthError && error.code === "APP_REFRESH_TOKEN_REPLAYED",
  );

  await assert.rejects(
    auth.refreshSession({
      refreshToken: rotated.tokenPair.refreshToken,
      traceId: "trace-after-replay",
    }),
    (error) => error instanceof AppAuthError && error.code === "APP_REFRESH_TOKEN_REPLAYED",
  );
});

test("refresh requires device match when bound", async () => {
  const auth = createAppSessionAuthService({
    jwtSecret: "fleetfeast-auth-test-secret",
  });

  const first = await auth.issueSession({
    userId: "user-3",
    role: "consumer",
    persona: "consumer",
    traceId: "trace-initial",
    deviceId: "device-a",
  });

  await assert.rejects(
    auth.refreshSession({
      refreshToken: first.tokenPair.refreshToken,
      traceId: "trace-mismatch",
      deviceId: "device-b",
    }),
    (error) =>
      error instanceof AppAuthError && error.code === "APP_REFRESH_TOKEN_DEVICE_MISMATCH",
  );
});
