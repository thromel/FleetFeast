import type { StoreStatus } from "./store-status-types.js";

export class InMemoryStoreStatusRepository {
  private readonly statuses = new Map<string, StoreStatus>();

  async save(status: StoreStatus): Promise<void> {
    this.statuses.set(status.storeId, status);
  }

  async findByStoreId(storeId: string): Promise<StoreStatus | null> {
    return this.statuses.get(storeId) ?? null;
  }
}
