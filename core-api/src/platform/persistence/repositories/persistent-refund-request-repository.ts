import { InMemoryRefundRequestRepository } from "../../../modules/payments/in-memory-refund-request-repository.js";
import type { RefundRequest } from "../../../modules/payments/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "payments.refund_requests";

export class PersistentRefundRequestRepository extends InMemoryRefundRequestRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(refund: RefundRequest): Promise<void> {
    await this.store.put(NAMESPACE, refund.refundRequestId, { ...refund });
  }

  override async findById(refundRequestId: string): Promise<RefundRequest | null> {
    const refund = await this.store.get<RefundRequest>(NAMESPACE, refundRequestId);
    return refund ? { ...refund } : null;
  }
}
