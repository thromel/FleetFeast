import { InMemoryItemAvailabilityRepository } from "../../../modules/merchant-catalog/in-memory-item-availability-repository.js";
import type { ItemAvailabilityRecord } from "../../../modules/merchant-catalog/item-availability-types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "catalog.item_availability";

export class PersistentItemAvailabilityRepository extends InMemoryItemAvailabilityRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(record: ItemAvailabilityRecord): Promise<void> {
    await this.store.put(NAMESPACE, record.itemId, record);
  }

  override async findByItemId(itemId: string): Promise<ItemAvailabilityRecord | null> {
    return this.store.get<ItemAvailabilityRecord>(NAMESPACE, itemId);
  }
}
