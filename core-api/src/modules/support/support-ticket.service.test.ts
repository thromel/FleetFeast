import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySupportTicketRepository } from "./in-memory-support-ticket-repository.js";
import {
  SupportTicketNotFoundError,
  SupportTicketService,
} from "./support-ticket-service.js";

test("creates support ticket with OPEN status", async () => {
  const service = new SupportTicketService(new InMemorySupportTicketRepository(), {
    getOrderTimeline: () => [],
    getPaymentAudit: async () => [],
  });

  const ticket = await service.createTicket({
    orderId: "order-1",
    actorId: "consumer-1",
    issueType: "LATE_DELIVERY",
    summary: "Order has not arrived",
  });

  assert.equal(ticket.orderId, "order-1");
  assert.equal(ticket.status, "OPEN");
});

test("builds correlated timeline from order and payment sources", async () => {
  const service = new SupportTicketService(new InMemorySupportTicketRepository(), {
    getOrderTimeline: () => [
      {
        orderId: "order-2",
        eventType: "order.created.v1",
        status: "CREATED",
        occurredAt: "2026-02-16T10:00:00Z",
        details: {},
      },
    ],
    getPaymentAudit: async () => [
      {
        auditEventId: "audit-1",
        orderId: "order-2",
        actionType: "PAYMENT_AUTHORIZED",
        targetId: "payment-intent-1",
        reasonCode: "PAYMENT_AUTHORIZED",
        timestamp: "2026-02-16T10:01:00Z",
        metadata: {},
      },
    ],
  });

  const ticket = await service.createTicket({
    orderId: "order-2",
    actorId: "consumer-2",
    issueType: "PAYMENT_ISSUE",
    summary: "Payment captured twice",
  });

  const timeline = await service.getCorrelatedTimeline(ticket.ticketId);
  assert.equal(timeline.entries.length, 2);
  assert.equal(timeline.entries[0]?.sourceType, "ORDER_TIMELINE");
  assert.equal(timeline.entries[1]?.sourceType, "PAYMENT_AUDIT");
});

test("throws when loading timeline for unknown ticket", async () => {
  const service = new SupportTicketService(new InMemorySupportTicketRepository(), {
    getOrderTimeline: () => [],
    getPaymentAudit: async () => [],
  });

  await assert.rejects(
    () => service.getCorrelatedTimeline("ticket-missing"),
    (error: unknown) => error instanceof SupportTicketNotFoundError,
  );
});
