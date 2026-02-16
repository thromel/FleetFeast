import type { Basket } from "./types.js";

export class InMemoryBasketRepository {
  private readonly baskets = new Map<string, Basket>();

  async save(basket: Basket): Promise<void> {
    this.baskets.set(basket.id, basket);
  }

  async findById(basketId: string): Promise<Basket | null> {
    return this.baskets.get(basketId) ?? null;
  }
}
