import type { PaymentAuditRecord } from "./types.js";

export class InMemoryPaymentAuditRepository {
  private readonly records: PaymentAuditRecord[] = [];

  async append(record: PaymentAuditRecord): Promise<void> {
    this.records.push({
      ...record,
      metadata: { ...record.metadata },
    });
  }

  async listByOrder(orderId: string): Promise<PaymentAuditRecord[]> {
    return this.records
      .filter((record) => record.orderId === orderId)
      .map((record) => ({
        ...record,
        metadata: { ...record.metadata },
      }));
  }
}
