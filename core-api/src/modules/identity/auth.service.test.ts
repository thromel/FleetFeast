import assert from "node:assert/strict";
import test from "node:test";

import { AuthError, AuthService } from "./auth-service.js";
import { InMemoryEventBus } from "./in-memory-event-bus.js";
import { InMemoryIdentityRepository } from "./in-memory-identity-repository.js";
import { IdentityService } from "./identity-service.js";
import { InMemorySessionStore } from "./in-memory-session-store.js";

test("issues access and refresh tokens for valid credentials", async () => {
  const repo = new InMemoryIdentityRepository();
  const eventBus = new InMemoryEventBus();
  const identityService = new IdentityService(repo, eventBus);
  const sessionStore = new InMemorySessionStore();
  const authService = new AuthService(repo, eventBus, sessionStore, "test-secret");

  await identityService.register({
    email: "auth@example.com",
    phone: "+15555550111",
    passwordHash: "pw-hash",
    role: "consumer",
  });

  const session = await authService.login({
    email: "auth@example.com",
    passwordHash: "pw-hash",
  });

  assert.ok(session.accessToken.split(".").length === 3);
  assert.ok(session.refreshToken.length > 20);
  assert.equal(eventBus.events.some((event) => event.type === "identity.session_issued.v1"), true);
});

test("rotates refresh token and rejects replay", async () => {
  const repo = new InMemoryIdentityRepository();
  const eventBus = new InMemoryEventBus();
  const identityService = new IdentityService(repo, eventBus);
  const sessionStore = new InMemorySessionStore();
  const authService = new AuthService(repo, eventBus, sessionStore, "test-secret");

  await identityService.register({
    email: "refresh@example.com",
    phone: "+15555550112",
    passwordHash: "pw-hash",
    role: "consumer",
  });

  const initial = await authService.login({
    email: "refresh@example.com",
    passwordHash: "pw-hash",
  });

  const rotated = await authService.refresh(initial.refreshToken);
  assert.notEqual(rotated.refreshToken, initial.refreshToken);

  await assert.rejects(
    authService.refresh(initial.refreshToken),
    (error: unknown) => {
      const typedError = error as AuthError;
      assert.ok(typedError instanceof AuthError);
      assert.equal(typedError.code, "IDENTITY_REFRESH_REPLAY_DETECTED");
      return true;
    },
  );
});
