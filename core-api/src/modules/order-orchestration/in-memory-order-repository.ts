import type { Order } from "./types.js";

export class InMemoryOrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) ?? null;
  }
}
