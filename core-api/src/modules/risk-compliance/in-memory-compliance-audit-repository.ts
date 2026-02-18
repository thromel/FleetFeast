import type { ComplianceAuditEvent } from "./types.js";

export class InMemoryComplianceAuditRepository {
  private readonly events: ComplianceAuditEvent[] = [];

  async append(event: ComplianceAuditEvent): Promise<void> {
    this.events.push({ ...event, metadata: { ...event.metadata } });
  }

  async list(): Promise<ComplianceAuditEvent[]> {
    return this.events.map((event) => ({
      ...event,
      metadata: { ...event.metadata },
    }));
  }

  async latest(): Promise<ComplianceAuditEvent | null> {
    if (this.events.length === 0) {
      return null;
    }

    const latest = this.events[this.events.length - 1];
    if (!latest) {
      return null;
    }

    return {
      ...latest,
      metadata: { ...latest.metadata },
    };
  }
}
