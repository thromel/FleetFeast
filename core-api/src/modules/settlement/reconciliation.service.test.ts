import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { SettlementReconciliationService } from "./settlement-reconciliation-service.js";

test("reconciliation flags mismatches above tolerance", async () => {
  const eventBus = new InMemoryEventBus();
  const reconciliationService = new SettlementReconciliationService(eventBus);

  const result = await reconciliationService.reconcile({
    expectedRecords: [
      { entityId: "merchant-1", amount: 1200 },
      { entityId: "courier-1", amount: 800 },
    ],
    actualRecords: [
      { entityId: "merchant-1", amount: 1195 },
      { entityId: "courier-1", amount: 600 },
    ],
    toleranceCents: 10,
  });

  assert.equal(result.exceptionCases.length, 1);
  assert.equal(result.exceptionCases[0]?.entityId, "courier-1");

  const completedEvent = eventBus.events.find(
    (event) => event.type === "settlement.reconciliation_completed.v1",
  );
  assert.ok(completedEvent);
});
