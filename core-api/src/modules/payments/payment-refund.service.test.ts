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
  PaymentRefundAmountInvalidError,
  PaymentService,
} from "./payment-service.js";

async function createOrderFixture(orderService: OrderService, checkoutRepository: InMemoryCheckoutRepository) {
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);

  await quoteRepository.save({
    quoteId: "quote-refund",
    quoteHash: "hash-refund",
    basketId: "basket-refund",
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
    basketId: "basket-refund",
    quoteId: "quote-refund",
    quoteHash: "hash-refund",
  });

  return orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-refund",
  });
}

test("creates refund request and completes it after approval", async () => {
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
  await paymentService.capturePayment({
    paymentIntentId: authorized.paymentIntentId,
    idempotencyKey: "refund-capture-key",
  });

  const refund = await paymentService.requestRefund({
    orderId: order.id,
    paymentIntentId: authorized.paymentIntentId,
    amount: 500,
    reasonCode: "ITEM_MISSING",
    requestedBy: "support-agent-1",
  });
  assert.equal(refund.status, "REQUESTED");

  const completed = await paymentService.approveRefund({
    refundRequestId: refund.refundRequestId,
    approvedBy: "finance-ops-1",
  });
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.amount, 500);

  const refundEvent = eventBus.events.find((event) => event.type === "refund.completed.v1");
  assert.ok(refundEvent);
});

test("rejects refund request when amount exceeds captured total", async () => {
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
  await paymentService.capturePayment({
    paymentIntentId: authorized.paymentIntentId,
    idempotencyKey: "refund-capture-key-2",
  });

  await assert.rejects(
    () =>
      paymentService.requestRefund({
        orderId: order.id,
        paymentIntentId: authorized.paymentIntentId,
        amount: 2500,
        reasonCode: "REQUESTED_TOO_MUCH",
        requestedBy: "support-agent-2",
      }),
    (error: unknown) =>
      error instanceof PaymentRefundAmountInvalidError &&
      error.code === "PAYMENT_REFUND_AMOUNT_INVALID",
  );
});
