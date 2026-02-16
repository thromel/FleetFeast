import assert from "node:assert/strict";
import test from "node:test";

import { CheckoutService } from "../consumer-ordering/checkout-service.js";
import { InMemoryCheckoutRepository } from "../consumer-ordering/in-memory-checkout-repository.js";
import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryQuoteRepository } from "../pricing-promotions/in-memory-quote-repository.js";
import { InMemoryOrderRepository } from "../order-orchestration/in-memory-order-repository.js";
import { OrderService } from "../order-orchestration/order-service.js";
import { InMemoryPaymentIntentRepository } from "./in-memory-payment-intent-repository.js";
import { InMemoryPSPAdapter } from "./in-memory-psp-adapter.js";
import { PaymentService } from "./payment-service.js";

async function createOrderFixture(orderService: OrderService, checkoutRepository: InMemoryCheckoutRepository) {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);

  await quoteRepository.save({
    quoteId: "quote-payment",
    quoteHash: "hash-payment",
    basketId: "basket-payment",
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
    basketId: "basket-payment",
    quoteId: "quote-payment",
    quoteHash: "hash-payment",
  });

  return orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-payment",
  });
}

test("authorizes digital payment and emits payment.authorized.v1", async () => {
  const checkoutRepository = new InMemoryCheckoutRepository();
  const orderRepository = new InMemoryOrderRepository();
  const eventBus = new InMemoryEventBus();
  const orderService = new OrderService(checkoutRepository, orderRepository, eventBus);

  const order = await createOrderFixture(orderService, checkoutRepository);
  const paymentService = new PaymentService(
    orderRepository,
    new InMemoryPaymentIntentRepository(),
    new InMemoryPSPAdapter(),
    eventBus,
  );

  const intent = await paymentService.authorizePayment({
    orderId: order.id,
    method: "CARD",
    amount: 1912,
    currency: "USD",
  });

  assert.equal(intent.status, "AUTHORIZED");
  assert.equal(intent.method, "CARD");
  assert.ok(intent.providerReference);
  assert.ok(eventBus.events.find((event) => event.type === "payment.authorized.v1"));
});
