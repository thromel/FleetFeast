import { InMemoryOrderRepository } from "../../../modules/order-orchestration/in-memory-order-repository.js";
import type { Order } from "../../../modules/order-orchestration/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "orders.records";

export class PersistentOrderRepository extends InMemoryOrderRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(order: Order): Promise<void> {
    await this.store.put(NAMESPACE, order.id, { ...order });
  }

  override async findById(orderId: string): Promise<Order | null> {
    const order = await this.store.get<Order>(NAMESPACE, orderId);
    return order ? { ...order } : null;
  }

  override async list(): Promise<Order[]> {
    const orders = await this.store.list<Order>(NAMESPACE);
    return orders.map((order) => ({ ...order }));
  }
}
