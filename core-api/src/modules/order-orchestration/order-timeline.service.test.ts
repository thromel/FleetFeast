import assert from "node:assert/strict";
import test from "node:test";

import { CheckoutService } from "../consumer-ordering/checkout-service.js";
import { InMemoryCheckoutRepository } from "../consumer-ordering/in-memory-checkout-repository.js";
import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryQuoteRepository } from "../pricing-promotions/in-memory-quote-repository.js";
import { InMemoryOrderRepository } from "./in-memory-order-repository.js";
import { InMemoryOrderTimelineRepository } from "./in-memory-order-timeline-repository.js";
import { OrderService } from "./order-service.js";
import { OrderTimelineService } from "./order-timeline-service.js";

async function createOrderFixture(orderService: OrderService, checkoutRepository: InMemoryCheckoutRepository) {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);

  await quoteRepository.save({
    quoteId: "quote-timeline",
    quoteHash: "hash-timeline",
    basketId: "basket-timeline",
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
    basketId: "basket-timeline",
    quoteId: "quote-timeline",
    quoteHash: "hash-timeline",
  });

  return orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-timeline",
  });
}

test("rebuild replays event log into immutable timeline entries", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const eventBus = new InMemoryEventBus();
  const timelineRepository = new InMemoryOrderTimelineRepository();
  const timelineService = new OrderTimelineService(eventBus, timelineRepository);
  const orderService = new OrderService(
    checkoutRepository,
    orderRepository,
    eventBus,
    timelineService,
  );

  const order = await createOrderFixture(orderService, checkoutRepository);
  await orderService.merchantAcceptOrder(order.id);
  await orderService.requestDispatch(order.id);

  const before = await timelineService.getTimeline(order.id);
  assert.deepEqual(before.map((entry) => entry.eventType), [
    "order.created.v1",
    "order.confirmed.v1",
    "dispatch.assignment.requested.v1",
  ]);

  const rebuild = await timelineService.rebuildFromEventLog();
  assert.equal(rebuild.entriesRebuilt, before.length);

  const after = await timelineService.getTimeline(order.id);
  assert.deepEqual(after.map((entry) => entry.eventType), before.map((entry) => entry.eventType));
  assert.equal(after.length, before.length);
});
