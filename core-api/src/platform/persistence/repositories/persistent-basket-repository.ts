import { InMemoryBasketRepository } from "../../../modules/consumer-ordering/in-memory-basket-repository.js";
import type { Basket } from "../../../modules/consumer-ordering/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "ordering.baskets";

export class PersistentBasketRepository extends InMemoryBasketRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(basket: Basket): Promise<void> {
    await this.store.put(NAMESPACE, basket.id, basket);
  }

  override async findById(basketId: string): Promise<Basket | null> {
    return this.store.get<Basket>(NAMESPACE, basketId);
  }
}
