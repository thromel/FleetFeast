import { InMemorySettlementReconciliationImportRepository } from "../../../modules/settlement/in-memory-settlement-reconciliation-import-repository.js";
import type { SettlementReconciliationImportRun } from "../../../modules/settlement/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "settlement.reconciliation_import_runs";

function runKey(run: SettlementReconciliationImportRun): string {
  return `${run.scheduleId}:${run.runAt}`;
}

export class PersistentSettlementReconciliationImportRepository extends InMemorySettlementReconciliationImportRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(run: SettlementReconciliationImportRun): Promise<void> {
    await super.save(run);
    await this.store.put(NAMESPACE, runKey(run), {
      ...run,
      result: {
        ...run.result,
        exceptionCases: run.result.exceptionCases.map((exceptionCase) => ({ ...exceptionCase })),
      },
    });
  }

  override async findByScheduleRun(
    scheduleId: string,
    runAt: string,
  ): Promise<SettlementReconciliationImportRun | null> {
    const runs = await this.store.list<SettlementReconciliationImportRun>(NAMESPACE);
    const run = runs.find((candidate) => candidate.scheduleId === scheduleId && candidate.runAt === runAt);
    if (!run) {
      return null;
    }

    return {
      ...run,
      result: {
        ...run.result,
        exceptionCases: run.result.exceptionCases.map((exceptionCase) => ({ ...exceptionCase })),
      },
    };
  }
}
