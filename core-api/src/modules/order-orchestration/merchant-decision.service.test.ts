import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCheckoutRepository } from "../consumer-ordering/in-memory-checkout-repository.js";
import { CheckoutService } from "../consumer-ordering/checkout-service.js";
import { InMemoryQuoteRepository } from "../pricing-promotions/in-memory-quote-repository.js";
import { InMemoryOrderRepository } from "./in-memory-order-repository.js";
import { OrderService } from "./order-service.js";

async function createOrderFixture(
  orderService: OrderService,
  checkoutRepository: InMemoryCheckoutRepository,
): Promise<{ orderId: string }> {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);

  await quoteRepository.save({
    quoteId: "quote-fixture",
    quoteHash: "hash-fixture",
    basketId: "basket-fixture",
    currency: "USD",
    subtotalCents: 1299,
    taxCents: 115,
    serviceFeeCents: 199,
    deliveryFeeCents: 299,
    discountCents: 0,
    totalCents: 1912,
    promo: null,
    generatedAt: new Date().toISOString(),
  });

  const checkout = await checkoutService.createCheckout({
    basketId: "basket-fixture",
    quoteId: "quote-fixture",
    quoteHash: "hash-fixture",
  });

  const order = await orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-fixture",
  });

  return { orderId: order.id };
}

test("auto-cancels order when merchant decision times out", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const orderService = new OrderService(checkoutRepository, orderRepository);

  const fixture = await createOrderFixture(orderService, checkoutRepository);
  const timedOut = await orderService.handleMerchantDecisionTimeout(fixture.orderId);

  assert.equal(timedOut.status, "CANCELLED");
  assert.equal(timedOut.cancellationReason, "MERCHANT_TIMEOUT");
});

test("does not cancel order after merchant acceptance", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const orderService = new OrderService(checkoutRepository, orderRepository);

  const fixture = await createOrderFixture(orderService, checkoutRepository);
  await orderService.merchantAcceptOrder(fixture.orderId);
  const result = await orderService.handleMerchantDecisionTimeout(fixture.orderId);

  assert.equal(result.status, "MERCHANT_ACCEPTED");
});
