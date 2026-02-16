import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "./in-memory-event-bus.js";
import { InMemoryIdentityRepository } from "./in-memory-identity-repository.js";
import { DuplicateIdentityError, IdentityService } from "./identity-service.js";

test("registers a new user with unique email and phone", async () => {
  const repo = new InMemoryIdentityRepository();
  const events = new InMemoryEventBus();
  const service = new IdentityService(repo, events);

  const user = await service.register({
    email: "alice@example.com",
    phone: "+15555550101",
    passwordHash: "hash-1",
    role: "consumer",
  });

  assert.equal(user.email, "alice@example.com");
  assert.equal(user.phone, "+15555550101");
  assert.equal(events.events.length, 1);
  assert.equal(events.events[0]?.type, "identity.user_registered.v1");
});

test("rejects duplicate email with deterministic code", async () => {
  const repo = new InMemoryIdentityRepository();
  const events = new InMemoryEventBus();
  const service = new IdentityService(repo, events);

  await service.register({
    email: "duplicate@example.com",
    phone: "+15555550102",
    passwordHash: "hash-1",
    role: "consumer",
  });

  await assert.rejects(
    service.register({
      email: "duplicate@example.com",
      phone: "+15555550103",
      passwordHash: "hash-2",
      role: "consumer",
    }),
    (error: unknown) => {
      const typedError = error as DuplicateIdentityError;
      assert.ok(typedError instanceof DuplicateIdentityError);
      assert.equal(typedError.code, "IDENTITY_EMAIL_EXISTS");
      return true;
    },
  );

  assert.equal(events.events.length, 1);
});

test("rejects duplicate phone with deterministic code", async () => {
  const repo = new InMemoryIdentityRepository();
  const events = new InMemoryEventBus();
  const service = new IdentityService(repo, events);

  await service.register({
    email: "first@example.com",
    phone: "+15555550104",
    passwordHash: "hash-1",
    role: "consumer",
  });

  await assert.rejects(
    service.register({
      email: "second@example.com",
      phone: "+15555550104",
      passwordHash: "hash-2",
      role: "consumer",
    }),
    (error: unknown) => {
      const typedError = error as DuplicateIdentityError;
      assert.ok(typedError instanceof DuplicateIdentityError);
      assert.equal(typedError.code, "IDENTITY_PHONE_EXISTS");
      return true;
    },
  );

  assert.equal(events.events.length, 1);
});
