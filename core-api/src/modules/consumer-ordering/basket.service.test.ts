import assert from "node:assert/strict";
import test from "node:test";

import { BasketService } from "./basket-service.js";
import { InMemoryBasketRepository } from "./in-memory-basket-repository.js";
import { InMemoryItemAvailabilityRepository } from "../merchant-catalog/in-memory-item-availability-repository.js";
import { ItemAvailabilityService } from "../merchant-catalog/item-availability-service.js";

test("creates basket and updates items with modifiers and notes", async () => {
  const basketRepo = new InMemoryBasketRepository();
  const itemRepo = new InMemoryItemAvailabilityRepository();
  const itemService = new ItemAvailabilityService(itemRepo);
  const service = new BasketService(basketRepo, itemService);

  const basket = await service.createBasket({
    consumerId: "consumer-1",
    merchantId: "merchant-1",
    currency: "USD",
  });

  const updated = await service.updateBasket(basket.id, {
    items: [
      {
        itemId: "item-1",
        name: "Burger",
        quantity: 2,
        unitPriceCents: 1299,
        modifiers: ["extra-cheese", "no-onion"],
        note: "well done",
      },
    ],
  });

  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0]?.modifiers.length, 2);
  assert.equal(updated.items[0]?.note, "well done");
});

test("rejects unavailable item when updating basket", async () => {
  const basketRepo = new InMemoryBasketRepository();
  const itemRepo = new InMemoryItemAvailabilityRepository();
  const itemService = new ItemAvailabilityService(itemRepo);
  const service = new BasketService(basketRepo, itemService);

  await itemService.setAvailability("item-2", {
    available: false,
    reason: "OUT_OF_STOCK",
  });

  const basket = await service.createBasket({
    consumerId: "consumer-1",
    merchantId: "merchant-1",
    currency: "USD",
  });

  await assert.rejects(
    service.updateBasket(basket.id, {
      items: [
        {
          itemId: "item-2",
          name: "Sold Out Burger",
          quantity: 1,
          unitPriceCents: 1599,
          modifiers: [],
        },
      ],
    }),
    (error: unknown) => {
      const typedError = error as { code?: string };
      assert.equal(typedError.code, "ORDERING_ITEM_UNAVAILABLE");
      return true;
    },
  );
});
