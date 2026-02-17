import { createHash, randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryComplianceAuditRepository } from "./in-memory-compliance-audit-repository.js";
import type {
  AppendComplianceAuditEventInput,
  ComplianceAuditEvent,
  ComplianceEvidenceReport,
  GenerateComplianceEvidenceInput,
} from "./types.js";

export class ComplianceAuditWriteError extends Error {
  code = "COMPLIANCE_AUDIT_WRITE_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "ComplianceAuditWriteError";
  }
}

export class ComplianceAuditService {
  constructor(
    private readonly repository: InMemoryComplianceAuditRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async appendEvent(input: AppendComplianceAuditEventInput): Promise<ComplianceAuditEvent> {
    const previousHash = this.repository.latest()?.hash ?? "GENESIS";
    const timestamp = new Date().toISOString();
    const auditEventId = randomUUID();
    const hash = this.computeHash({
      auditEventId,
      actionType: input.actionType,
      actorId: input.actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      reasonCode: input.reasonCode,
      metadata: input.metadata,
      timestamp,
      previousHash,
    });

    const event: ComplianceAuditEvent = {
      auditEventId,
      actionType: input.actionType,
      actorId: input.actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      reasonCode: input.reasonCode,
      metadata: input.metadata,
      timestamp,
      previousHash,
      hash,
    };

    try {
      await this.repository.append(event);
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Unknown audit write failure";
      this.eventBus.publish({
        type: "platform.audit_write_failure_alert.v1",
        occurredAt: timestamp,
        payload: {
          actionType: event.actionType,
          targetType: event.targetType,
          targetId: event.targetId,
          reasonCode: event.reasonCode,
          failureMessage,
        },
      });
      throw new ComplianceAuditWriteError(failureMessage);
    }

    this.eventBus.publish({
      type: "risk.audit_log_appended.v1",
      occurredAt: timestamp,
      payload: {
        auditEventId: event.auditEventId,
        actionType: event.actionType,
        targetType: event.targetType,
        targetId: event.targetId,
      },
    });

    return event;
  }

  listEvents(): ComplianceAuditEvent[] {
    return this.repository.list();
  }

  async generateEvidenceReport(
    input: GenerateComplianceEvidenceInput,
  ): Promise<ComplianceEvidenceReport> {
    const events = this.repository.list();
    const countByActionType: Record<string, number> = {};

    for (const event of events) {
      countByActionType[event.actionType] = (countByActionType[event.actionType] ?? 0) + 1;
    }

    const chainIntegrity = this.verifyChain(events);
    const report: ComplianceEvidenceReport = {
      reportId: randomUUID(),
      generatedBy: input.generatedBy,
      generatedAt: input.generatedAt,
      totalEvents: events.length,
      chainIntegrity,
      countByActionType,
    };

    this.eventBus.publish({
      type: "platform.evidence_generated.v1",
      occurredAt: input.generatedAt,
      payload: {
        reportId: report.reportId,
        generatedBy: report.generatedBy,
        totalEvents: report.totalEvents,
        chainIntegrity: report.chainIntegrity,
      },
    });

    return report;
  }

  private verifyChain(events: ComplianceAuditEvent[]): boolean {
    let expectedPreviousHash = "GENESIS";

    for (const event of events) {
      if (event.previousHash !== expectedPreviousHash) {
        return false;
      }

      const recalculated = this.computeHash({
        auditEventId: event.auditEventId,
        actionType: event.actionType,
        actorId: event.actorId,
        targetType: event.targetType,
        targetId: event.targetId,
        reasonCode: event.reasonCode,
        metadata: event.metadata,
        timestamp: event.timestamp,
        previousHash: event.previousHash,
      });

      if (recalculated !== event.hash) {
        return false;
      }

      expectedPreviousHash = event.hash;
    }

    return true;
  }

  private computeHash(value: Record<string, unknown>): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
