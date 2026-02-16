import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryStoreStatusRepository } from "./in-memory-store-status-repository.js";
import { StoreStatusService } from "./store-status-service.js";

test("paused store is not orderable", async () => {
  const repo = new InMemoryStoreStatusRepository();
  const service = new StoreStatusService(repo);

  await service.setStatus("store-1", {
    paused: true,
    schedule: { open: "00:00", close: "23:59", timezone: "UTC" },
  });

  const result = await service.evaluateOrderability("store-1", new Date("2026-02-16T12:00:00.000Z"));
  assert.equal(result.orderable, false);
  assert.equal(result.reason, "STORE_PAUSED");
});

test("store outside schedule is not orderable", async () => {
  const repo = new InMemoryStoreStatusRepository();
  const service = new StoreStatusService(repo);

  await service.setStatus("store-1", {
    paused: false,
    schedule: { open: "09:00", close: "18:00", timezone: "UTC" },
  });

  const result = await service.evaluateOrderability("store-1", new Date("2026-02-16T20:00:00.000Z"));
  assert.equal(result.orderable, false);
  assert.equal(result.reason, "OUTSIDE_STORE_HOURS");
});

test("store in schedule and unpaused is orderable", async () => {
  const repo = new InMemoryStoreStatusRepository();
  const service = new StoreStatusService(repo);

  await service.setStatus("store-1", {
    paused: false,
    schedule: { open: "09:00", close: "18:00", timezone: "UTC" },
  });

  const result = await service.evaluateOrderability("store-1", new Date("2026-02-16T12:00:00.000Z"));
  assert.equal(result.orderable, true);
  assert.equal(result.reason, "OK");
});
