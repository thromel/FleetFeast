import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemorySettlementReconciliationImportRepository } from "./in-memory-settlement-reconciliation-import-repository.js";
import { SettlementReconciliationService } from "./settlement-reconciliation-service.js";
import type {
  RunSettlementReconciliationImportInput,
  SettlementReconciliationImportRun,
} from "./types.js";

export class SettlementReconciliationImportService {
  constructor(
    private readonly repository: InMemorySettlementReconciliationImportRepository,
    private readonly reconciliationService: SettlementReconciliationService,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async runScheduledImport(
    input: RunSettlementReconciliationImportInput,
  ): Promise<{ run: SettlementReconciliationImportRun; created: boolean }> {
    const existing = await this.repository.findByScheduleRun(input.scheduleId, input.runAt);
    if (existing) {
      return {
        run: existing,
        created: false,
      };
    }

    const result = await this.reconciliationService.reconcile(input.reconciliationInput);
    const createdAt = new Date().toISOString();
    const run: SettlementReconciliationImportRun = {
      importRunId: randomUUID(),
      scheduleId: input.scheduleId,
      runAt: input.runAt,
      sourceFileName: input.sourceFileName,
      ingestedRecords: input.ingestedRecords,
      createdAt,
      result,
    };

    await this.repository.save(run);
    this.eventBus.publish({
      type: "settlement.reconciliation_import.completed.v1",
      occurredAt: createdAt,
      payload: {
        importRunId: run.importRunId,
        scheduleId: run.scheduleId,
        runAt: run.runAt,
        sourceFileName: run.sourceFileName,
        reconciliationId: run.result.reconciliationId,
      },
    });

    return {
      run,
      created: true,
    };
  }
}
