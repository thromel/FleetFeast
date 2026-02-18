import type { SettlementReconciliationResult } from "./types.js";

function cloneResult(result: SettlementReconciliationResult): SettlementReconciliationResult {
  return {
    ...result,
    exceptionCases: result.exceptionCases.map((exceptionCase) => ({
      ...exceptionCase,
    })),
  };
}

export class InMemorySettlementReconciliationRepository {
  private readonly results: SettlementReconciliationResult[] = [];

  async append(result: SettlementReconciliationResult): Promise<void> {
    this.results.push(cloneResult(result));
  }

  async list(limit?: number): Promise<SettlementReconciliationResult[]> {
    const normalizedLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;

    const sorted = [...this.results].sort((left, right) =>
      right.reconciledAt.localeCompare(left.reconciledAt),
    );
    const sliced = normalizedLimit ? sorted.slice(0, normalizedLimit) : sorted;
    return sliced.map((result) => cloneResult(result));
  }
}
