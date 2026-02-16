import type { PayoutBatch } from "./types.js";

export class InMemoryPayoutBatchRepository {
  private readonly batches = new Map<string, PayoutBatch>();

  async save(batch: PayoutBatch): Promise<void> {
    this.batches.set(batch.payoutBatchId, batch);
  }
}
