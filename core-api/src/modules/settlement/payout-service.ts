import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryPayoutBatchRepository } from "./in-memory-payout-batch-repository.js";
import type { GeneratePayoutBatchInput, PayoutBatch } from "./types.js";

export class PayoutService {
  constructor(
    private readonly payoutBatchRepository: InMemoryPayoutBatchRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async generateBatch(input: GeneratePayoutBatchInput): Promise<PayoutBatch> {
    const createdAt = new Date().toISOString();
    const batch: PayoutBatch = {
      payoutBatchId: randomUUID(),
      scheduleId: input.scheduleId,
      runAt: input.runAt,
      payouts: [],
      holds: [],
      status: "GENERATED",
      createdAt,
    };

    for (const candidate of input.candidates) {
      if (candidate.hasException) {
        batch.holds.push({
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          reason: candidate.holdReason ?? "UNRESOLVED_EXCEPTION",
        });
      } else {
        batch.payouts.push({
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          amount: candidate.amount,
        });
      }
    }

    await this.payoutBatchRepository.save(batch);
    this.eventBus.publish({
      type: "payout.batch_generated.v1",
      occurredAt: createdAt,
      payload: {
        payoutBatchId: batch.payoutBatchId,
        scheduleId: batch.scheduleId,
        payoutCount: batch.payouts.length,
        holdCount: batch.holds.length,
      },
    });

    return batch;
  }
}
