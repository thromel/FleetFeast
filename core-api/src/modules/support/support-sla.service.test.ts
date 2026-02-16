import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemorySupportEscalationRepository } from "./in-memory-support-escalation-repository.js";
import { InMemorySupportTicketRepository } from "./in-memory-support-ticket-repository.js";
import { SupportSLAService } from "./support-sla-service.js";

test("escalates overdue open tickets", async () => {
  const ticketRepository = new InMemorySupportTicketRepository();
  const escalationRepository = new InMemorySupportEscalationRepository();
  const eventBus = new InMemoryEventBus();

  await ticketRepository.save({
    ticketId: "ticket-1",
    orderId: "order-1",
    actorId: "consumer-1",
    issueType: "PAYMENT_ISSUE",
    summary: "Need investigation",
    status: "OPEN",
    createdAt: "2026-02-16T10:00:00Z",
    updatedAt: "2026-02-16T10:00:00Z",
  });

  const service = new SupportSLAService(ticketRepository, escalationRepository, eventBus);
  const result = await service.evaluateEscalations({
    evaluatedAt: "2026-02-16T12:00:00Z",
  });

  assert.equal(result.escalations.length, 1);
  assert.equal(result.escalations[0]?.ticketId, "ticket-1");
  const escalatedEvent = eventBus.events.find((event) => event.type === "support.ticket_escalated.v1");
  assert.ok(escalatedEvent);
});
