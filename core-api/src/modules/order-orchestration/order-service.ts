import { randomUUID } from "node:crypto";

import { InMemoryCheckoutRepository } from "../consumer-ordering/in-memory-checkout-repository.js";
import { InMemoryBasketRepository } from "../consumer-ordering/in-memory-basket-repository.js";
import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import type { DomainEvent } from "../identity/types.js";
import { InMemoryOrderRepository } from "./in-memory-order-repository.js";
import { OrderTimelineService } from "./order-timeline-service.js";
import type {
  CancellationActor,
  CreateOrderInput,
  Order,
  OrderStatus,
  RequestCancellationInput,
} from "./types.js";

export class InvalidCheckoutError extends Error {
  code = "ORDER_INVALID_CHECKOUT";

  constructor(checkoutId: string) {
    super(`Checkout '${checkoutId}' was not found.`);
    this.name = "InvalidCheckoutError";
  }
}

export class OrderNotFoundError extends Error {
  code = "ORDER_NOT_FOUND";

  constructor(orderId: string) {
    super(`Order '${orderId}' was not found.`);
    this.name = "OrderNotFoundError";
  }
}

export class QuoteHashMismatchError extends Error {
  code = "ORDER_QUOTE_HASH_MISMATCH";

  constructor() {
    super("Quote hash does not match checkout snapshot.");
    this.name = "QuoteHashMismatchError";
  }
}

export class CancellationNotAllowedError extends Error {
  code = "ORDER_CANCELLATION_NOT_ALLOWED";

  constructor(orderId: string, actor: CancellationActor, status: OrderStatus) {
    super(`Actor '${actor}' cannot cancel order '${orderId}' in status '${status}'.`);
    this.name = "CancellationNotAllowedError";
  }
}

const cancellationPolicy: Record<CancellationActor, ReadonlySet<OrderStatus>> = {
  consumer: new Set(["CREATED", "MERCHANT_ACCEPTED"]),
  merchant_operator: new Set(["CREATED", "MERCHANT_ACCEPTED", "DISPATCH_PENDING", "COURIER_ASSIGNED"]),
  support_agent: new Set(["CREATED", "MERCHANT_ACCEPTED", "DISPATCH_PENDING", "COURIER_ASSIGNED"]),
  system_admin: new Set(["CREATED", "MERCHANT_ACCEPTED", "DISPATCH_PENDING", "COURIER_ASSIGNED"]),
};

export class OrderService {
  constructor(
    private readonly checkoutRepository: InMemoryCheckoutRepository,
    private readonly orderRepository: InMemoryOrderRepository,
    private readonly eventBus: InMemoryEventBus = new InMemoryEventBus(),
    private readonly timelineService?: OrderTimelineService,
    private readonly basketRepository?: InMemoryBasketRepository,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const checkout = await this.checkoutRepository.findById(input.checkoutId);
    if (!checkout) {
      throw new InvalidCheckoutError(input.checkoutId);
    }

    if (checkout.quoteHash !== input.quoteHash) {
      throw new QuoteHashMismatchError();
    }

    const basket = this.basketRepository
      ? await this.basketRepository.findById(checkout.basketId)
      : null;

    const now = new Date().toISOString();
    const order: Order = {
      id: randomUUID(),
      checkoutId: input.checkoutId,
      quoteHash: input.quoteHash,
      consumerId: basket?.consumerId ?? null,
      merchantId: basket?.merchantId ?? null,
      courierId: null,
      status: "CREATED",
      cancellationReason: null,
      cancelledBy: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.orderRepository.save(order);
    this.publishEvent({
      type: "order.created.v1",
      occurredAt: now,
      payload: {
        orderId: order.id,
        checkoutId: order.checkoutId,
      },
    });
    return order;
  }

  async merchantAcceptOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status !== "CREATED") {
      return order;
    }

    const updated: Order = {
      ...order,
      status: "MERCHANT_ACCEPTED",
      courierId: null,
      cancellationReason: null,
      cancelledBy: null,
      updatedAt: new Date().toISOString(),
    };

    await this.orderRepository.save(updated);
    this.publishEvent({
      type: "order.confirmed.v1",
      occurredAt: updated.updatedAt,
      payload: {
        orderId: updated.id,
      },
    });
    return updated;
  }

  async handleMerchantDecisionTimeout(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status !== "CREATED") {
      return order;
    }

    const updated: Order = {
      ...order,
      status: "CANCELLED",
      cancellationReason: "MERCHANT_TIMEOUT",
      cancelledBy: "system",
      updatedAt: new Date().toISOString(),
    };

    await this.orderRepository.save(updated);
    this.publishEvent({
      type: "order.cancelled.v1",
      occurredAt: updated.updatedAt,
      payload: {
        orderId: updated.id,
        reasonCode: updated.cancellationReason,
        cancelledBy: updated.cancelledBy,
      },
    });
    return updated;
  }

  async requestDispatch(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status !== "MERCHANT_ACCEPTED") {
      return order;
    }

    const updated: Order = {
      ...order,
      status: "DISPATCH_PENDING",
      courierId: null,
      updatedAt: new Date().toISOString(),
    };

    await this.orderRepository.save(updated);
    this.publishEvent({
      type: "dispatch.assignment.requested.v1",
      occurredAt: updated.updatedAt,
      payload: {
        orderId: updated.id,
        checkoutId: updated.checkoutId,
      },
    });
    return updated;
  }

  async assignCourier(orderId: string, courierId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status === "COURIER_ASSIGNED" && order.courierId === courierId) {
      return order;
    }

    if (order.status !== "DISPATCH_PENDING") {
      return order;
    }

    const updated: Order = {
      ...order,
      courierId,
      status: "COURIER_ASSIGNED",
      updatedAt: new Date().toISOString(),
    };

    await this.orderRepository.save(updated);
    this.publishEvent({
      type: "dispatch.assignment.completed.v1",
      occurredAt: updated.updatedAt,
      payload: {
        orderId: updated.id,
        courierId,
      },
    });
    return updated;
  }

  async markPickedUp(orderId: string, courierId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status === "PICKED_UP" && order.courierId === courierId) {
      return order;
    }

    if (order.status !== "COURIER_ASSIGNED" || order.courierId !== courierId) {
      return order;
    }

    const updated: Order = {
      ...order,
      status: "PICKED_UP",
      updatedAt: new Date().toISOString(),
    };

    await this.orderRepository.save(updated);
    this.publishEvent({
      type: "order.picked_up.v1",
      occurredAt: updated.updatedAt,
      payload: {
        orderId: updated.id,
        courierId,
      },
    });
    return updated;
  }

  async markDelivered(orderId: string, courierId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status === "DELIVERED" && order.courierId === courierId) {
      return order;
    }

    if (order.status !== "PICKED_UP" || order.courierId !== courierId) {
      return order;
    }

    const updated: Order = {
      ...order,
      status: "DELIVERED",
      updatedAt: new Date().toISOString(),
    };

    await this.orderRepository.save(updated);
    this.publishEvent({
      type: "order.delivered.v1",
      occurredAt: updated.updatedAt,
      payload: {
        orderId: updated.id,
        courierId,
      },
    });
    return updated;
  }

  async getOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    return order;
  }

  async requestCancellation(orderId: string, input: RequestCancellationInput): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status === "CANCELLED") {
      return order;
    }

    const allowedStates = cancellationPolicy[input.actor];
    if (!allowedStates.has(order.status)) {
      throw new CancellationNotAllowedError(order.id, input.actor, order.status);
    }

    const now = new Date().toISOString();
    this.publishEvent({
      type: "order.cancel_requested.v1",
      occurredAt: now,
      payload: {
        orderId: order.id,
        reasonCode: input.reasonCode,
        cancelledBy: input.actor,
      },
    });

    const updated: Order = {
      ...order,
      status: "CANCELLED",
      cancellationReason: input.reasonCode,
      cancelledBy: input.actor,
      updatedAt: now,
    };

    await this.orderRepository.save(updated);
    this.publishEvent({
      type: "order.cancelled.v1",
      occurredAt: now,
      payload: {
        orderId: updated.id,
        reasonCode: input.reasonCode,
        cancelledBy: input.actor,
      },
    });
    return updated;
  }

  async listOrders(input?: {
    consumerId?: string;
    merchantId?: string;
    status?: OrderStatus;
  }): Promise<Order[]> {
    const orders = await this.orderRepository.list();
    return orders.filter((order) => {
      if (input?.consumerId && order.consumerId !== input.consumerId) {
        return false;
      }
      if (input?.merchantId && order.merchantId !== input.merchantId) {
        return false;
      }
      if (input?.status && order.status !== input.status) {
        return false;
      }
      return true;
    });
  }

  private publishEvent(event: DomainEvent): void {
    this.eventBus.publish(event);
    this.timelineService?.projectEvent(event);
  }
}
