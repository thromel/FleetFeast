import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCheckoutRepository } from "../consumer-ordering/in-memory-checkout-repository.js";
import { CheckoutService } from "../consumer-ordering/checkout-service.js";
import { InMemoryQuoteRepository } from "../pricing-promotions/in-memory-quote-repository.js";
import { OrderService } from "./order-service.js";
import { InMemoryOrderRepository } from "./in-memory-order-repository.js";

test("creates order in CREATED state from valid checkout", async () => {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutRepository = new InMemoryCheckoutRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);
  const orderRepository = new InMemoryOrderRepository();
  const orderService = new OrderService(checkoutRepository, orderRepository);

  await quoteRepository.save({
    quoteId: "quote-1",
    quoteHash: "hash-1",
    basketId: "basket-1",
    currency: "USD",
    subtotalCents: 2598,
    taxCents: 231,
    serviceFeeCents: 199,
    deliveryFeeCents: 299,
    discountCents: 260,
    totalCents: 3067,
    promo: null,
    generatedAt: new Date().toISOString(),
  });

  const checkout = await checkoutService.createCheckout({
    basketId: "basket-1",
    quoteId: "quote-1",
    quoteHash: "hash-1",
  });

  const order = await orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-1",
  });

  assert.equal(order.status, "CREATED");
  assert.equal(order.checkoutId, checkout.checkoutId);
  assert.equal(order.quoteHash, "hash-1");
});
