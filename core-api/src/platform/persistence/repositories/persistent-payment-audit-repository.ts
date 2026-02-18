import { InMemoryPaymentAuditRepository } from "../../../modules/payments/in-memory-payment-audit-repository.js";
import type { PaymentAuditRecord } from "../../../modules/payments/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "payments.audit_records";

export class PersistentPaymentAuditRepository extends InMemoryPaymentAuditRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async append(record: PaymentAuditRecord): Promise<void> {
    await this.store.put(NAMESPACE, record.auditEventId, {
      ...record,
      metadata: { ...record.metadata },
    });
  }

  override async listByOrder(orderId: string): Promise<PaymentAuditRecord[]> {
    const records = await this.store.list<PaymentAuditRecord>(NAMESPACE);
    return records
      .filter((record) => record.orderId === orderId)
      .map((record) => ({
        ...record,
        metadata: { ...record.metadata },
      }));
  }
}
