import { InMemorySettlementReconciliationRepository } from "../../../modules/settlement/in-memory-settlement-reconciliation-repository.js";
import type { SettlementReconciliationResult } from "../../../modules/settlement/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "settlement.reconciliation_results";

function resultKey(result: SettlementReconciliationResult): string {
  return `${result.reconciledAt}:${result.reconciliationId}`;
}

export class PersistentSettlementReconciliationRepository extends InMemorySettlementReconciliationRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async append(result: SettlementReconciliationResult): Promise<void> {
    await super.append({
      ...result,
      exceptionCases: result.exceptionCases.map((exceptionCase) => ({ ...exceptionCase })),
    });
    await this.store.put(NAMESPACE, resultKey(result), {
      ...result,
      exceptionCases: result.exceptionCases.map((exceptionCase) => ({ ...exceptionCase })),
    });
  }

  override async list(limit?: number): Promise<SettlementReconciliationResult[]> {
    const normalizedLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;
    const results = await this.store.list<SettlementReconciliationResult>(NAMESPACE);
    const sorted = results.sort((left, right) => right.reconciledAt.localeCompare(left.reconciledAt));
    const sliced = normalizedLimit ? sorted.slice(0, normalizedLimit) : sorted;

    return sliced.map((result) => ({
      ...result,
      exceptionCases: result.exceptionCases.map((exceptionCase) => ({ ...exceptionCase })),
    }));
  }
}
