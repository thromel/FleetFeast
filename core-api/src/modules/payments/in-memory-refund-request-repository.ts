import type { RefundRequest } from "./types.js";

export class InMemoryRefundRequestRepository {
  private readonly refunds = new Map<string, RefundRequest>();

  async save(refund: RefundRequest): Promise<void> {
    this.refunds.set(refund.refundRequestId, refund);
  }

  async findById(refundRequestId: string): Promise<RefundRequest | null> {
    return this.refunds.get(refundRequestId) ?? null;
  }
}
