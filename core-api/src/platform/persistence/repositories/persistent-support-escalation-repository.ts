import { InMemorySupportEscalationRepository } from "../../../modules/support/in-memory-support-escalation-repository.js";
import type { SupportEscalationRecord } from "../../../modules/support/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "support.escalations";

export class PersistentSupportEscalationRepository extends InMemorySupportEscalationRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(escalation: SupportEscalationRecord): Promise<void> {
    await super.save({ ...escalation });
    await this.store.put(NAMESPACE, escalation.escalationId, { ...escalation });
  }

  override async hasEscalationForTicket(ticketId: string): Promise<boolean> {
    const escalations = await this.store.list<SupportEscalationRecord>(NAMESPACE);
    return escalations.some((escalation) => escalation.ticketId === ticketId);
  }

  override async list(): Promise<SupportEscalationRecord[]> {
    const escalations = await this.store.list<SupportEscalationRecord>(NAMESPACE);
    return escalations.map((escalation) => ({ ...escalation }));
  }
}
