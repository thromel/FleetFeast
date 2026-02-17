import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryComplianceAuditRepository } from "./in-memory-compliance-audit-repository.js";
import { ComplianceAuditService } from "./compliance-audit-service.js";

test("appends immutable compliance audit event with hash chain", async () => {
  const eventBus = new InMemoryEventBus();
  const repository = new InMemoryComplianceAuditRepository();
  const service = new ComplianceAuditService(repository, eventBus);

  const first = await service.appendEvent({
    actionType: "REFUND_COMPLETED",
    actorId: "finance-ops-1",
    targetType: "REFUND",
    targetId: "refund-1",
    reasonCode: "CUSTOMER_COMPENSATION",
    metadata: { amountCents: 500 },
  });

  const second = await service.appendEvent({
    actionType: "PAYOUT_RELEASED",
    actorId: "finance-ops-1",
    targetType: "PAYOUT",
    targetId: "payout-1",
    reasonCode: "WEEKLY_SETTLEMENT",
    metadata: { amountCents: 1200 },
  });

  assert.equal(first.previousHash, "GENESIS");
  assert.equal(second.previousHash, first.hash);
  const appendedEvent = eventBus.events.find((event) => event.type === "risk.audit_log_appended.v1");
  assert.ok(appendedEvent);
});

test("generates compliance evidence report with chain integrity", async () => {
  const eventBus = new InMemoryEventBus();
  const repository = new InMemoryComplianceAuditRepository();
  const service = new ComplianceAuditService(repository, eventBus);

  await service.appendEvent({
    actionType: "ADMIN_BREAK_GLASS",
    actorId: "admin-1",
    targetType: "ADMIN_ACTION",
    targetId: "break-glass-1",
    reasonCode: "INCIDENT_RESPONSE",
    metadata: {},
  });

  const report = await service.generateEvidenceReport({
    generatedBy: "compliance-job",
    generatedAt: "2026-02-16T12:00:00Z",
  });

  assert.equal(report.totalEvents, 1);
  assert.equal(report.chainIntegrity, true);
  assert.equal(report.countByActionType["ADMIN_BREAK_GLASS"], 1);
  const evidenceEvent = eventBus.events.find((event) => event.type === "platform.evidence_generated.v1");
  assert.ok(evidenceEvent);
});

test("emits critical alert and throws when audit append fails", async () => {
  const eventBus = new InMemoryEventBus();

  class FailingAuditRepository extends InMemoryComplianceAuditRepository {
    override async append(): Promise<void> {
      throw new Error("audit sink down");
    }
  }

  const service = new ComplianceAuditService(new FailingAuditRepository(), eventBus);

  await assert.rejects(
    () =>
      service.appendEvent({
        actionType: "ADMIN_BREAK_GLASS",
        actorId: "admin-1",
        targetType: "ADMIN_ACTION",
        targetId: "break-glass-2",
        reasonCode: "INCIDENT_RESPONSE",
        metadata: {},
      }),
    (error: unknown) =>
      error instanceof Error && "code" in error && (error as { code?: string }).code === "COMPLIANCE_AUDIT_WRITE_FAILED",
  );

  const failureAlert = eventBus.events.find(
    (event) => event.type === "platform.audit_write_failure_alert.v1",
  );
  assert.ok(failureAlert);
});
