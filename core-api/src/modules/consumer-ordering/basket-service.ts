import { randomUUID } from "node:crypto";

import { ItemAvailabilityService } from "../merchant-catalog/item-availability-service.js";
import { InMemoryBasketRepository } from "./in-memory-basket-repository.js";
import type {
  Basket,
  BasketItem,
  BasketItemInput,
  CreateBasketInput,
  UpdateBasketInput,
} from "./types.js";

export class BasketNotFoundError extends Error {
  code = "ORDERING_BASKET_NOT_FOUND";

  constructor(basketId: string) {
    super(`Basket '${basketId}' was not found.`);
    this.name = "BasketNotFoundError";
  }
}

export class BasketItemUnavailableError extends Error {
  code = "ORDERING_ITEM_UNAVAILABLE";
  itemIds: string[];

  constructor(itemIds: string[]) {
    super(`Unavailable items: ${itemIds.join(", ")}`);
    this.name = "BasketItemUnavailableError";
    this.itemIds = itemIds;
  }
}

function normalizeItems(items: BasketItemInput[]): BasketItem[] {
  return items.map((item) => ({
    itemId: item.itemId,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    modifiers: item.modifiers,
    note: item.note ?? null,
  }));
}

export class BasketService {
  constructor(
    private readonly repository: InMemoryBasketRepository,
    private readonly itemAvailabilityService: ItemAvailabilityService,
  ) {}

  async createBasket(input: CreateBasketInput): Promise<Basket> {
    const now = new Date().toISOString();
    const basket: Basket = {
      id: randomUUID(),
      consumerId: input.consumerId,
      merchantId: input.merchantId,
      currency: input.currency,
      items: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(basket);
    return basket;
  }

  async updateBasket(basketId: string, input: UpdateBasketInput): Promise<Basket> {
    const basket = await this.repository.findById(basketId);
    if (!basket) {
      throw new BasketNotFoundError(basketId);
    }

    const unavailableItemIds: string[] = [];
    for (const item of input.items) {
      const availability = await this.itemAvailabilityService.getAvailability(item.itemId);
      if (!availability.available) {
        unavailableItemIds.push(item.itemId);
      }
    }

    if (unavailableItemIds.length > 0) {
      throw new BasketItemUnavailableError(unavailableItemIds);
    }

    const updated: Basket = {
      ...basket,
      items: normalizeItems(input.items),
      updatedAt: new Date().toISOString(),
    };

    await this.repository.save(updated);
    return updated;
  }

  async getBasket(basketId: string): Promise<Basket> {
    const basket = await this.repository.findById(basketId);
    if (!basket) {
      throw new BasketNotFoundError(basketId);
    }

    return basket;
  }
}
