import { InMemoryPayoutBatchRepository } from "../../../modules/settlement/in-memory-payout-batch-repository.js";
import type { PayoutBatch } from "../../../modules/settlement/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "settlement.payout_batches";

export class PersistentPayoutBatchRepository extends InMemoryPayoutBatchRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(batch: PayoutBatch): Promise<void> {
    await this.store.put(NAMESPACE, batch.payoutBatchId, {
      ...batch,
      payouts: batch.payouts.map((payout) => ({ ...payout })),
      holds: batch.holds.map((hold) => ({ ...hold })),
    });
  }

  override async findByScheduleRun(scheduleId: string, runAt: string): Promise<PayoutBatch | null> {
    const batches = await this.store.list<PayoutBatch>(NAMESPACE);
    const batch = batches.find(
      (candidate) => candidate.scheduleId === scheduleId && candidate.runAt === runAt,
    );

    if (!batch) {
      return null;
    }

    return {
      ...batch,
      payouts: batch.payouts.map((payout) => ({ ...payout })),
      holds: batch.holds.map((hold) => ({ ...hold })),
    };
  }
}
