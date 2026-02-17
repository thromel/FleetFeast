import type { CheckoutPayload } from "../../../modules/consumer-ordering/checkout-service.js";
import { InMemoryCheckoutRepository } from "../../../modules/consumer-ordering/in-memory-checkout-repository.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "ordering.checkouts";

export class PersistentCheckoutRepository extends InMemoryCheckoutRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(checkout: CheckoutPayload): Promise<void> {
    await this.store.put(NAMESPACE, checkout.checkoutId, checkout);
  }

  override async findById(checkoutId: string): Promise<CheckoutPayload | null> {
    return this.store.get<CheckoutPayload>(NAMESPACE, checkoutId);
  }
}
