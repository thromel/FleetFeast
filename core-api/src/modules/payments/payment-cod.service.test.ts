import assert from "node:assert/strict";
import test from "node:test";

import { CheckoutService } from "../consumer-ordering/checkout-service.js";
import { InMemoryCheckoutRepository } from "../consumer-ordering/in-memory-checkout-repository.js";
import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryOrderRepository } from "../order-orchestration/in-memory-order-repository.js";
import { OrderService } from "../order-orchestration/order-service.js";
import { InMemoryQuoteRepository } from "../pricing-promotions/in-memory-quote-repository.js";
import { InMemoryPaymentIntentRepository } from "./in-memory-payment-intent-repository.js";
import { InMemoryPSPAdapter } from "./in-memory-psp-adapter.js";
import { PaymentService } from "./payment-service.js";

async function createOrderFixture(orderService: OrderService, checkoutRepository: InMemoryCheckoutRepository) {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);

  await quoteRepository.save({
    quoteId: "quote-cod",
    quoteHash: "hash-cod",
    basketId: "basket-cod",
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
    basketId: "basket-cod",
    quoteId: "quote-cod",
    quoteHash: "hash-cod",
  });

  return orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-cod",
  });
}

test("tracks expected and collected COD amount when values match", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const eventBus = new InMemoryEventBus();
  const orderService = new OrderService(checkoutRepository, orderRepository, eventBus);
  const paymentService = new PaymentService(
    orderRepository,
    new InMemoryPaymentIntentRepository(),
    new InMemoryPSPAdapter(),
    eventBus,
  );

  const order = await createOrderFixture(orderService, checkoutRepository);
  await paymentService.markCashExpected({
    orderId: order.id,
    expectedAmount: 1912,
    currency: "USD",
  });

  const result = await paymentService.confirmCashCollection({
    orderId: order.id,
    collectedAmount: 1912,
    courierId: "courier-1",
  });

  assert.equal(result.mismatch, false);
  assert.equal(result.expectedAmount, 1912);
  assert.equal(result.collectedAmount, 1912);
});

test("flags mismatch when collected COD amount differs from expectation", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const eventBus = new InMemoryEventBus();
  const orderService = new OrderService(checkoutRepository, orderRepository, eventBus);
  const paymentService = new PaymentService(
    orderRepository,
    new InMemoryPaymentIntentRepository(),
    new InMemoryPSPAdapter(),
    eventBus,
  );

  const order = await createOrderFixture(orderService, checkoutRepository);
  await paymentService.markCashExpected({
    orderId: order.id,
    expectedAmount: 1912,
    currency: "USD",
  });

  const result = await paymentService.confirmCashCollection({
    orderId: order.id,
    collectedAmount: 1700,
    courierId: "courier-2",
  });

  assert.equal(result.mismatch, true);
  const mismatchEvent = eventBus.events.find(
    (event) => event.type === "payment.cash_mismatch_detected.v1",
  );
  assert.ok(mismatchEvent);
});
