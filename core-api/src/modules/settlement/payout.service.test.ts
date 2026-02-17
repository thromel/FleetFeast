import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryPayoutBatchRepository } from "./in-memory-payout-batch-repository.js";
import { PayoutService } from "./payout-service.js";

test("generates payout batch and holds entities with unresolved exceptions", async () => {
  const eventBus = new InMemoryEventBus();
  const payoutService = new PayoutService(new InMemoryPayoutBatchRepository(), eventBus);

  const batch = await payoutService.generateBatch({
    scheduleId: "daily-0900",
    runAt: "2026-02-16T09:00:00Z",
    candidates: [
      {
        entityType: "MERCHANT",
        entityId: "merchant-1",
        amount: 1200,
        hasException: false,
      },
      {
        entityType: "COURIER",
        entityId: "courier-1",
        amount: 800,
        hasException: true,
        holdReason: "LEDGER_MISMATCH",
      },
    ],
  });

  assert.equal(batch.payouts.length, 1);
  assert.equal(batch.holds.length, 1);
  assert.equal(batch.holds[0]?.entityId, "courier-1");
  assert.equal(batch.holds[0]?.reason, "LEDGER_MISMATCH");

  const generatedEvent = eventBus.events.find((event) => event.type === "payout.batch_generated.v1");
  assert.ok(generatedEvent);
});

test("reuses existing payout batch for same schedule run and avoids duplicate events", async () => {
  const eventBus = new InMemoryEventBus();
  const payoutService = new PayoutService(new InMemoryPayoutBatchRepository(), eventBus);
  const input = {
    scheduleId: "daily-0900",
    runAt: "2026-02-16T09:00:00Z",
    candidates: [
      {
        entityType: "MERCHANT" as const,
        entityId: "merchant-1",
        amount: 1200,
        hasException: false,
      },
    ],
  };

  const first = await payoutService.generateBatch(input);
  const second = await payoutService.generateBatch(input);

  assert.equal(second.payoutBatchId, first.payoutBatchId);

  const generatedEvents = eventBus.events.filter((event) => event.type === "payout.batch_generated.v1");
  assert.equal(generatedEvents.length, 1);
});
