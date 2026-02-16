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
import {
  PaymentCapturePreconditionError,
  PaymentService,
} from "./payment-service.js";

async function createOrderFixture(orderService: OrderService, checkoutRepository: InMemoryCheckoutRepository) {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);

  await quoteRepository.save({
    quoteId: "quote-capture",
    quoteHash: "hash-capture",
    basketId: "basket-capture",
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
    basketId: "basket-capture",
    quoteId: "quote-capture",
    quoteHash: "hash-capture",
  });

  return orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-capture",
  });
}

test("captures authorized payment after merchant acceptance", async () => {
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
  await orderService.merchantAcceptOrder(order.id);
  const authorized = await paymentService.authorizePayment({
    orderId: order.id,
    method: "CARD",
    amount: 1912,
    currency: "USD",
  });

  const captured = await paymentService.capturePayment({
    paymentIntentId: authorized.paymentIntentId,
    idempotencyKey: "capture-key-1",
  });

  assert.equal(captured.status, "CAPTURED");
  const capturedEvents = eventBus.events.filter((event) => event.type === "payment.captured.v1");
  assert.equal(capturedEvents.length, 1);
});

test("capture is idempotent for repeated idempotency key", async () => {
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
  await orderService.merchantAcceptOrder(order.id);
  const authorized = await paymentService.authorizePayment({
    orderId: order.id,
    method: "CARD",
    amount: 1912,
    currency: "USD",
  });

  const first = await paymentService.capturePayment({
    paymentIntentId: authorized.paymentIntentId,
    idempotencyKey: "capture-key-2",
  });
  const second = await paymentService.capturePayment({
    paymentIntentId: authorized.paymentIntentId,
    idempotencyKey: "capture-key-2",
  });

  assert.equal(second.status, "CAPTURED");
  assert.equal(second.paymentIntentId, first.paymentIntentId);
  const capturedEvents = eventBus.events.filter((event) => event.type === "payment.captured.v1");
  assert.equal(capturedEvents.length, 1);
});

test("capture fails when merchant acceptance precondition is not met", async () => {
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
  const authorized = await paymentService.authorizePayment({
    orderId: order.id,
    method: "CARD",
    amount: 1912,
    currency: "USD",
  });

  await assert.rejects(
    () =>
      paymentService.capturePayment({
        paymentIntentId: authorized.paymentIntentId,
        idempotencyKey: "capture-key-3",
      }),
    (error: unknown) =>
      error instanceof PaymentCapturePreconditionError &&
      error.code === "PAYMENT_CAPTURE_PRECONDITION_FAILED",
  );
});
