import { InMemoryPaymentIntentRepository } from "../../../modules/payments/in-memory-payment-intent-repository.js";
import type { PaymentIntent, PaymentMethod } from "../../../modules/payments/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "payments.payment_intents";

export class PersistentPaymentIntentRepository extends InMemoryPaymentIntentRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(intent: PaymentIntent): Promise<void> {
    await this.store.put(NAMESPACE, intent.paymentIntentId, { ...intent });
  }

  override async findById(paymentIntentId: string): Promise<PaymentIntent | null> {
    const intent = await this.store.get<PaymentIntent>(NAMESPACE, paymentIntentId);
    return intent ? { ...intent } : null;
  }

  override async findByOrderAndMethod(
    orderId: string,
    method: PaymentMethod,
  ): Promise<PaymentIntent | null> {
    const intents = await this.store.list<PaymentIntent>(NAMESPACE);
    const intent = intents.find(
      (candidate) => candidate.orderId === orderId && candidate.method === method,
    );
    return intent ? { ...intent } : null;
  }
}
