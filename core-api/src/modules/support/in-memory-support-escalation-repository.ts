import type { SupportEscalationRecord } from "./types.js";

export class InMemorySupportEscalationRepository {
  private readonly escalations = new Map<string, SupportEscalationRecord>();
  private readonly ticketEscalationIndex = new Set<string>();

  async save(escalation: SupportEscalationRecord): Promise<void> {
    this.escalations.set(escalation.escalationId, escalation);
    this.ticketEscalationIndex.add(escalation.ticketId);
  }

  async hasEscalationForTicket(ticketId: string): Promise<boolean> {
    return this.ticketEscalationIndex.has(ticketId);
  }

  async list(): Promise<SupportEscalationRecord[]> {
    return [...this.escalations.values()];
  }
}
