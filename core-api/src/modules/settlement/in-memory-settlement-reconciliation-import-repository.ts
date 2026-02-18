import type { SettlementReconciliationImportRun } from "./types.js";

function cloneImportRun(
  run: SettlementReconciliationImportRun,
): SettlementReconciliationImportRun {
  return {
    ...run,
    result: {
      ...run.result,
      exceptionCases: run.result.exceptionCases.map((exceptionCase) => ({
        ...exceptionCase,
      })),
    },
  };
}

export class InMemorySettlementReconciliationImportRepository {
  private readonly runs = new Map<string, SettlementReconciliationImportRun>();

  async save(run: SettlementReconciliationImportRun): Promise<void> {
    this.runs.set(`${run.scheduleId}:${run.runAt}`, cloneImportRun(run));
  }

  async findByScheduleRun(
    scheduleId: string,
    runAt: string,
  ): Promise<SettlementReconciliationImportRun | null> {
    const run = this.runs.get(`${scheduleId}:${runAt}`);
    if (!run) {
      return null;
    }

    return cloneImportRun(run);
  }
}
