import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemorySettlementReconciliationRepository } from "./in-memory-settlement-reconciliation-repository.js";
import type {
  ReconcileSettlementInput,
  SettlementReconciliationExceptionCase,
  SettlementReconciliationExceptionReason,
  SettlementReconciliationResult,
} from "./types.js";

export class SettlementReconciliationService {
  constructor(
    private readonly eventBus: InMemoryEventBus,
    private readonly repository: InMemorySettlementReconciliationRepository,
  ) {}

  async reconcile(input: ReconcileSettlementInput): Promise<SettlementReconciliationResult> {
    const expectedByEntity = new Map(
      input.expectedRecords.map((record) => [record.entityId, record.amount]),
    );
    const actualByEntity = new Map(
      input.actualRecords.map((record) => [record.entityId, record.amount]),
    );
    const entityIds = new Set([...expectedByEntity.keys(), ...actualByEntity.keys()]);

    const exceptionCases: SettlementReconciliationExceptionCase[] = [];

    for (const entityId of entityIds) {
      const expectedPresent = expectedByEntity.has(entityId);
      const actualPresent = actualByEntity.has(entityId);
      const expectedAmount = expectedByEntity.get(entityId) ?? 0;
      const actualAmount = actualByEntity.get(entityId) ?? 0;
      const variance = actualAmount - expectedAmount;

      if (Math.abs(variance) <= input.toleranceCents) {
        continue;
      }

      const reason = this.resolveReason(expectedPresent, actualPresent);
      exceptionCases.push({
        entityId,
        expectedAmount,
        actualAmount,
        variance,
        reason,
      });
    }

    const reconciledAt = new Date().toISOString();
    const result: SettlementReconciliationResult = {
      reconciliationId: randomUUID(),
      reconciledAt,
      toleranceCents: input.toleranceCents,
      totalExpectedAmount: this.sumAmounts(expectedByEntity),
      totalActualAmount: this.sumAmounts(actualByEntity),
      exceptionCases,
    };

    this.eventBus.publish({
      type: "settlement.reconciliation_completed.v1",
      occurredAt: reconciledAt,
      payload: {
        reconciliationId: result.reconciliationId,
        toleranceCents: result.toleranceCents,
        exceptionCount: result.exceptionCases.length,
      },
    });
    await this.repository.append(result);

    return result;
  }

  async listResults(input?: {
    limit?: number;
    hasExceptions?: boolean;
  }): Promise<SettlementReconciliationResult[]> {
    const history = await this.repository.list();
    const filtered = this.filterByExceptionState(history, input?.hasExceptions);

    if (input?.limit === undefined) {
      return filtered;
    }

    return filtered.slice(0, input.limit);
  }

  async summarizeResults(input?: { hasExceptions?: boolean }): Promise<{
    totalRuns: number;
    runsWithExceptions: number;
    runsWithoutExceptions: number;
  }> {
    const history = await this.repository.list();
    const filtered = this.filterByExceptionState(history, input?.hasExceptions);
    const runsWithExceptions = filtered.filter((result) => result.exceptionCases.length > 0).length;

    return {
      totalRuns: filtered.length,
      runsWithExceptions,
      runsWithoutExceptions: filtered.length - runsWithExceptions,
    };
  }

  private sumAmounts(records: Map<string, number>): number {
    return [...records.values()].reduce((sum, amount) => sum + amount, 0);
  }

  private resolveReason(
    expectedPresent: boolean,
    actualPresent: boolean,
  ): SettlementReconciliationExceptionReason {
    if (!expectedPresent && actualPresent) {
      return "MISSING_EXPECTED_RECORD";
    }

    if (expectedPresent && !actualPresent) {
      return "MISSING_ACTUAL_RECORD";
    }

    return "AMOUNT_MISMATCH";
  }

  private filterByExceptionState(
    history: SettlementReconciliationResult[],
    hasExceptions?: boolean,
  ): SettlementReconciliationResult[] {
    if (hasExceptions === undefined) {
      return history;
    }

    return history.filter((result) =>
      hasExceptions ? result.exceptionCases.length > 0 : result.exceptionCases.length === 0,
    );
  }
}
