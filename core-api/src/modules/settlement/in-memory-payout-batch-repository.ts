import type { PayoutBatch } from "./types.js";

export class InMemoryPayoutBatchRepository {
  private readonly batches = new Map<string, PayoutBatch>();

  async save(batch: PayoutBatch): Promise<void> {
    this.batches.set(batch.payoutBatchId, {
      ...batch,
      payouts: batch.payouts.map((payout) => ({ ...payout })),
      holds: batch.holds.map((hold) => ({ ...hold })),
    });
  }

  async findByScheduleRun(scheduleId: string, runAt: string): Promise<PayoutBatch | null> {
    for (const batch of this.batches.values()) {
      if (batch.scheduleId !== scheduleId || batch.runAt !== runAt) {
        continue;
      }

      return {
        ...batch,
        payouts: batch.payouts.map((payout) => ({ ...payout })),
        holds: batch.holds.map((hold) => ({ ...hold })),
      };
    }

    return null;
  }
}
