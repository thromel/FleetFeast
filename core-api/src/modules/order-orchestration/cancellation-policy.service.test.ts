import assert from "node:assert/strict";
import test from "node:test";

import { CheckoutService } from "../consumer-ordering/checkout-service.js";
import { InMemoryCheckoutRepository } from "../consumer-ordering/in-memory-checkout-repository.js";
import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryQuoteRepository } from "../pricing-promotions/in-memory-quote-repository.js";
import { InMemoryOrderRepository } from "./in-memory-order-repository.js";
import {
  CancellationNotAllowedError,
  OrderService,
} from "./order-service.js";

async function createOrderFixture(orderService: OrderService, checkoutRepository: InMemoryCheckoutRepository) {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);

  await quoteRepository.save({
    quoteId: "quote-cancel",
    quoteHash: "hash-cancel",
    basketId: "basket-cancel",
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
    basketId: "basket-cancel",
    quoteId: "quote-cancel",
    quoteHash: "hash-cancel",
  });

  return orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-cancel",
  });
}

test("consumer can cancel CREATED order and emits cancellation events", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const eventBus = new InMemoryEventBus();
  const orderService = new OrderService(checkoutRepository, orderRepository, eventBus);

  const order = await createOrderFixture(orderService, checkoutRepository);
  const cancelled = await orderService.requestCancellation(order.id, {
    actor: "consumer",
    reasonCode: "CONSUMER_CHANGED_MIND",
  });

  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.cancellationReason, "CONSUMER_CHANGED_MIND");
  assert.equal(cancelled.cancelledBy, "consumer");
  assert.ok(eventBus.events.find((event) => event.type === "order.cancel_requested.v1"));
  assert.ok(eventBus.events.find((event) => event.type === "order.cancelled.v1"));
});

test("consumer cannot cancel DISPATCH_PENDING order", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const eventBus = new InMemoryEventBus();
  const orderService = new OrderService(checkoutRepository, orderRepository, eventBus);

  const order = await createOrderFixture(orderService, checkoutRepository);
  const accepted = await orderService.merchantAcceptOrder(order.id);
  await orderService.requestDispatch(accepted.id);

  await assert.rejects(
    () =>
      orderService.requestCancellation(order.id, {
        actor: "consumer",
        reasonCode: "TOO_EXPENSIVE",
      }),
    (error: unknown) =>
      error instanceof CancellationNotAllowedError &&
      error.code === "ORDER_CANCELLATION_NOT_ALLOWED",
  );
});

test("support can cancel DISPATCH_PENDING order", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const eventBus = new InMemoryEventBus();
  const orderService = new OrderService(checkoutRepository, orderRepository, eventBus);

  const order = await createOrderFixture(orderService, checkoutRepository);
  const accepted = await orderService.merchantAcceptOrder(order.id);
  await orderService.requestDispatch(accepted.id);

  const cancelled = await orderService.requestCancellation(order.id, {
    actor: "support_agent",
    reasonCode: "SUPPORT_INTERVENTION",
  });

  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.cancelledBy, "support_agent");
});
