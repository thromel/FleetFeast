import type { PaymentIntent } from "./types.js";
import type { PaymentMethod } from "./types.js";

export class InMemoryPaymentIntentRepository {
  private readonly intents = new Map<string, PaymentIntent>();

  async save(intent: PaymentIntent): Promise<void> {
    this.intents.set(intent.paymentIntentId, intent);
  }

  async findById(paymentIntentId: string): Promise<PaymentIntent | null> {
    return this.intents.get(paymentIntentId) ?? null;
  }

  async findByOrderAndMethod(orderId: string, method: PaymentMethod): Promise<PaymentIntent | null> {
    for (const intent of this.intents.values()) {
      if (intent.orderId === orderId && intent.method === method) {
        return intent;
      }
    }

    return null;
  }
}
