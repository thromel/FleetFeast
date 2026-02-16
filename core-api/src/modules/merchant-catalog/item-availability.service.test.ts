import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryItemAvailabilityRepository } from "./in-memory-item-availability-repository.js";
import { ItemAvailabilityService } from "./item-availability-service.js";

test("toggles item availability and persists latest status", async () => {
  const repository = new InMemoryItemAvailabilityRepository();
  const service = new ItemAvailabilityService(repository);

  await service.setAvailability("item-1", { available: true });
  const unavailable = await service.setAvailability("item-1", {
    available: false,
    reason: "OUT_OF_STOCK",
  });

  assert.equal(unavailable.itemId, "item-1");
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.reason, "OUT_OF_STOCK");

  const current = await service.getAvailability("item-1");
  assert.equal(current.available, false);
});
