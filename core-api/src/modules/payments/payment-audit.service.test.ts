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
    quoteId: "quote-audit",
    quoteHash: "hash-audit",
    basketId: "basket-audit",
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
    basketId: "basket-audit",
    quoteId: "quote-audit",
    quoteHash: "hash-audit",
  });

  return orderService.createOrder({
    checkoutId: checkout.checkoutId,
    quoteHash: "hash-audit",
  });
}

test("payment service appends immutable audit records for state transitions", async () => {
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
    idempotencyKey: "audit-capture-key",
  });

  const trail = await paymentService.getAuditTrail(order.id);
  const actionTypes = trail.map((record) => record.actionType);
  assert.ok(actionTypes.includes("PAYMENT_AUTHORIZED"));
  assert.ok(actionTypes.includes("PAYMENT_CAPTURED"));

  if (trail.length > 0) {
    trail[0]!.actionType = "MUTATED";
  }
  const secondRead = await paymentService.getAuditTrail(order.id);
  assert.ok(!secondRead.some((record) => record.actionType === "MUTATED"));

  const auditEvents = eventBus.events.filter((event) => event.type === "payment.audit_recorded.v1");
  assert.ok(auditEvents.length >= 2);
});
