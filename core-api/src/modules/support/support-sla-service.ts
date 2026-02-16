import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemorySupportEscalationRepository } from "./in-memory-support-escalation-repository.js";
import { InMemorySupportTicketRepository } from "./in-memory-support-ticket-repository.js";
import type {
  EvaluateSupportSLAInput,
  SupportEscalationRecord,
  SupportSLAEvaluationResult,
} from "./types.js";

const issueTypeSlaMinutes: Record<string, number> = {
  PAYMENT_ISSUE: 30,
  LATE_DELIVERY: 30,
  MISSING_ITEM: 45,
};

export class SupportSLAService {
  constructor(
    private readonly ticketRepository: InMemorySupportTicketRepository,
    private readonly escalationRepository: InMemorySupportEscalationRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async evaluateEscalations(input: EvaluateSupportSLAInput): Promise<SupportSLAEvaluationResult> {
    const evaluatedAt = new Date(input.evaluatedAt).toISOString();
    const escalations: SupportEscalationRecord[] = [];

    for (const ticket of this.ticketRepository.listByStatus("OPEN")) {
      if (this.escalationRepository.hasEscalationForTicket(ticket.ticketId)) {
        continue;
      }

      const createdAtMs = new Date(ticket.createdAt).getTime();
      const evaluatedAtMs = new Date(evaluatedAt).getTime();
      const ageMinutes = Math.floor((evaluatedAtMs - createdAtMs) / 60000);
      const thresholdMinutes = issueTypeSlaMinutes[ticket.issueType] ?? 60;

      if (ageMinutes < thresholdMinutes) {
        continue;
      }

      const escalation: SupportEscalationRecord = {
        escalationId: randomUUID(),
        ticketId: ticket.ticketId,
        orderId: ticket.orderId,
        issueType: ticket.issueType,
        escalatedAt: evaluatedAt,
        reasonCode: "SLA_BREACH",
      };

      await this.escalationRepository.save(escalation);
      this.eventBus.publish({
        type: "support.ticket_escalated.v1",
        occurredAt: escalation.escalatedAt,
        payload: {
          escalationId: escalation.escalationId,
          ticketId: escalation.ticketId,
          orderId: escalation.orderId,
          reasonCode: escalation.reasonCode,
        },
      });
      escalations.push(escalation);
    }

    return {
      evaluatedAt,
      escalations,
    };
  }
}
