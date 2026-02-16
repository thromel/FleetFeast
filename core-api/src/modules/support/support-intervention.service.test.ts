import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { SupportInterventionService } from "./support-intervention-service.js";

test("reassignment intervention emits support intervention event", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new SupportInterventionService(
    {
      requestCancellation: async () => ({ status: "CANCELLED" }),
      requestRefund: async () => ({ status: "REQUESTED" }),
    },
    eventBus,
  );

  const result = await service.execute({
    actionType: "REASSIGN_COURIER",
    actorId: "support-1",
    orderId: "order-1",
    reasonCode: "COURIER_NO_SHOW",
  });

  assert.equal(result.status, "QUEUED");
  const event = eventBus.events.find(
    (candidate) => candidate.type === "support.intervention_executed.v1",
  );
  assert.ok(event);
});
