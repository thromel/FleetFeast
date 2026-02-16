import { InMemoryItemAvailabilityRepository } from "./in-memory-item-availability-repository.js";
import type {
  ItemAvailabilityRecord,
  UpdateItemAvailabilityInput,
} from "./item-availability-types.js";

export class ItemAvailabilityService {
  constructor(private readonly repository: InMemoryItemAvailabilityRepository) {}

  async setAvailability(
    itemId: string,
    input: UpdateItemAvailabilityInput,
  ): Promise<ItemAvailabilityRecord> {
    const record: ItemAvailabilityRecord = {
      itemId,
      available: input.available,
      reason: input.reason ?? null,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.save(record);
    return record;
  }

  async getAvailability(itemId: string): Promise<ItemAvailabilityRecord> {
    const record = await this.repository.findByItemId(itemId);
    if (record) {
      return record;
    }

    return {
      itemId,
      available: true,
      reason: null,
      updatedAt: new Date().toISOString(),
    };
  }
}
