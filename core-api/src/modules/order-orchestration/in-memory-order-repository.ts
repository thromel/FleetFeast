import type { Order } from "./types.js";

export class InMemoryOrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, { ...order });
  }

  async findById(orderId: string): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (!order) {
      return null;
    }

    return { ...order };
  }

  async list(): Promise<Order[]> {
    return Array.from(this.orders.values()).map((order) => ({ ...order }));
  }
}
