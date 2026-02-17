import { InMemoryStoreStatusRepository } from "../../../modules/merchant-catalog/in-memory-store-status-repository.js";
import type { StoreStatus } from "../../../modules/merchant-catalog/store-status-types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "catalog.store_status";

export class PersistentStoreStatusRepository extends InMemoryStoreStatusRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(status: StoreStatus): Promise<void> {
    await this.store.put(NAMESPACE, status.storeId, status);
  }

  override async findByStoreId(storeId: string): Promise<StoreStatus | null> {
    return this.store.get<StoreStatus>(NAMESPACE, storeId);
  }
}
