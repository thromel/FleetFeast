import { randomUUID } from "node:crypto";

import { InMemorySupportTicketRepository } from "./in-memory-support-ticket-repository.js";
import type {
  CreateSupportTicketInput,
  SupportCorrelationSources,
  SupportTicket,
  SupportTicketTimelineView,
  SupportTimelineEntry,
} from "./types.js";

export class SupportTicketNotFoundError extends Error {
  code = "SUPPORT_TICKET_NOT_FOUND";

  constructor(ticketId: string) {
    super(`Support ticket '${ticketId}' was not found.`);
    this.name = "SupportTicketNotFoundError";
  }
}

export class SupportTicketService {
  constructor(
    private readonly repository: InMemorySupportTicketRepository,
    private readonly correlationSources: SupportCorrelationSources,
  ) {}

  async createTicket(input: CreateSupportTicketInput): Promise<SupportTicket> {
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      ticketId: randomUUID(),
      orderId: input.orderId,
      actorId: input.actorId,
      issueType: input.issueType,
      summary: input.summary,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(ticket);
    return ticket;
  }

  async getCorrelatedTimeline(ticketId: string): Promise<SupportTicketTimelineView> {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new SupportTicketNotFoundError(ticketId);
    }

    const orderTimelineEntries = this.correlationSources
      .getOrderTimeline(ticket.orderId)
      .map<SupportTimelineEntry>((entry) => ({
        sourceType: "ORDER_TIMELINE",
        referenceId: entry.eventType,
        eventType: entry.eventType,
        occurredAt: entry.occurredAt,
        details: {
          status: entry.status,
          ...entry.details,
        },
      }));

    const paymentAuditEntries = (await this.correlationSources.getPaymentAudit(ticket.orderId)).map<
      SupportTimelineEntry
    >((entry) => ({
      sourceType: "PAYMENT_AUDIT",
      referenceId: entry.auditEventId,
      eventType: entry.actionType,
      occurredAt: entry.timestamp,
      details: {
        reasonCode: entry.reasonCode,
        targetId: entry.targetId,
        ...entry.metadata,
      },
    }));

    const entries = [...orderTimelineEntries, ...paymentAuditEntries].sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt),
    );

    return {
      ticket,
      entries,
    };
  }
}
