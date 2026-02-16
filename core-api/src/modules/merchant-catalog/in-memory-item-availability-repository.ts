import type { ItemAvailabilityRecord } from "./item-availability-types.js";

export class InMemoryItemAvailabilityRepository {
  private readonly records = new Map<string, ItemAvailabilityRecord>();

  async save(record: ItemAvailabilityRecord): Promise<void> {
    this.records.set(record.itemId, record);
  }

  async findByItemId(itemId: string): Promise<ItemAvailabilityRecord | null> {
    return this.records.get(itemId) ?? null;
  }
}
