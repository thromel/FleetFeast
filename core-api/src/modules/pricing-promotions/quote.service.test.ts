import assert from "node:assert/strict";
import test from "node:test";

import { BasketService } from "../consumer-ordering/basket-service.js";
import { InMemoryBasketRepository } from "../consumer-ordering/in-memory-basket-repository.js";
import { InMemoryItemAvailabilityRepository } from "../merchant-catalog/in-memory-item-availability-repository.js";
import { ItemAvailabilityService } from "../merchant-catalog/item-availability-service.js";
import { QuoteService } from "./quote-service.js";

test("calculates quote totals without promo", async () => {
  const basketRepo = new InMemoryBasketRepository();
  const basketService = new BasketService(
    basketRepo,
    new ItemAvailabilityService(new InMemoryItemAvailabilityRepository()),
  );
  const quoteService = new QuoteService(basketRepo);

  const basket = await basketService.createBasket({
    consumerId: "consumer-1",
    merchantId: "merchant-1",
    currency: "USD",
  });

  await basketService.updateBasket(basket.id, {
    items: [
      {
        itemId: "item-1",
        name: "Burger",
        quantity: 2,
        unitPriceCents: 1299,
        modifiers: [],
      },
    ],
  });

  const quote = await quoteService.generateQuote({ basketId: basket.id });

  assert.equal(quote.subtotalCents, 2598);
  assert.equal(quote.taxCents, 231);
  assert.equal(quote.discountCents, 0);
  assert.equal(quote.totalCents, 3327);
});

test("applies WELCOME10 promo on eligible basket", async () => {
  const basketRepo = new InMemoryBasketRepository();
  const basketService = new BasketService(
    basketRepo,
    new ItemAvailabilityService(new InMemoryItemAvailabilityRepository()),
  );
  const quoteService = new QuoteService(basketRepo);

  const basket = await basketService.createBasket({
    consumerId: "consumer-1",
    merchantId: "merchant-1",
    currency: "USD",
  });

  await basketService.updateBasket(basket.id, {
    items: [
      {
        itemId: "item-1",
        name: "Burger",
        quantity: 2,
        unitPriceCents: 1299,
        modifiers: [],
      },
    ],
  });

  const quote = await quoteService.generateQuote({
    basketId: basket.id,
    promoCode: "WELCOME10",
  });

  assert.equal(quote.discountCents, 260);
  assert.equal(quote.totalCents, 3067);
  assert.equal(quote.promo?.eligible, true);
});
