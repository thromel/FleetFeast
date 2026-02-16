import type { CheckoutPayload } from "./checkout-service.js";

export class InMemoryCheckoutRepository {
  private readonly checkouts = new Map<string, CheckoutPayload>();

  async save(checkout: CheckoutPayload): Promise<void> {
    this.checkouts.set(checkout.checkoutId, checkout);
  }

  async findById(checkoutId: string): Promise<CheckoutPayload | null> {
    return this.checkouts.get(checkoutId) ?? null;
  }
}
