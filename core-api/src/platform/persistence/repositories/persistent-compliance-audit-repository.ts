import { InMemoryComplianceAuditRepository } from "../../../modules/risk-compliance/in-memory-compliance-audit-repository.js";
import type { ComplianceAuditEvent } from "../../../modules/risk-compliance/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "risk.compliance_audit_events";

export class PersistentComplianceAuditRepository extends InMemoryComplianceAuditRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async append(event: ComplianceAuditEvent): Promise<void> {
    await super.append({
      ...event,
      metadata: { ...event.metadata },
    });
    await this.store.put(NAMESPACE, event.auditEventId, {
      ...event,
      metadata: { ...event.metadata },
    });
  }

  override async list(): Promise<ComplianceAuditEvent[]> {
    const events = await this.store.list<ComplianceAuditEvent>(NAMESPACE);
    return events.map((event) => ({
      ...event,
      metadata: { ...event.metadata },
    }));
  }

  override async latest(): Promise<ComplianceAuditEvent | null> {
    const entries = await this.store.listEntries<ComplianceAuditEvent>(NAMESPACE);
    if (entries.length === 0) {
      return null;
    }

    const lastEntry = entries[entries.length - 1];
    if (!lastEntry) {
      return null;
    }

    return {
      ...lastEntry.value,
      metadata: { ...lastEntry.value.metadata },
    };
  }
}
