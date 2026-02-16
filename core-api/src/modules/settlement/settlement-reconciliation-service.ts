import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import type {
  ReconcileSettlementInput,
  SettlementReconciliationExceptionCase,
  SettlementReconciliationExceptionReason,
  SettlementReconciliationResult,
} from "./types.js";

export class SettlementReconciliationService {
  constructor(private readonly eventBus: InMemoryEventBus) {}

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

    return result;
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
}
