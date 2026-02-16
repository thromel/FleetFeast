import assert from "node:assert/strict";
import test from "node:test";

import { CheckoutService } from "../consumer-ordering/checkout-service.js";
import { InMemoryCheckoutRepository } from "../consumer-ordering/in-memory-checkout-repository.js";
import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryQuoteRepository } from "../pricing-promotions/in-memory-quote-repository.js";
import { InMemoryOrderRepository } from "./in-memory-order-repository.js";
import { OrderService } from "./order-service.js";

async function createAcceptedOrder(orderService: OrderService, checkoutRepository: InMemoryCheckoutRepository) {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);

  await quoteRepository.save({
    quoteId: "quote-dispatch",
    quoteHash: "hash-dispatch",
    basketId: "basket-dispatch",
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
    basketId: "basket-dispatch",
    quoteId: "quote-dispatch",
    quoteHash: "hash-dispatch",
  });

  const order = await orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-dispatch",
  });

  return orderService.merchantAcceptOrder(order.id);
}

test("requests dispatch and emits assignment requested event", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const eventBus = new InMemoryEventBus();
  const orderService = new OrderService(checkoutRepository, orderRepository, eventBus);

  const accepted = await createAcceptedOrder(orderService, checkoutRepository);
  const dispatched = await orderService.requestDispatch(accepted.id);

  assert.equal(dispatched.status, "DISPATCH_PENDING");
  const dispatchEvent = eventBus.events.find(
    (event) => event.type === "dispatch.assignment.requested.v1",
  );
  assert.ok(dispatchEvent);
});
