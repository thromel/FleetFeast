import type { DeliveryZone } from "./delivery-zone-types.js";

export class InMemoryDeliveryZoneRepository {
  private readonly zones = new Map<string, DeliveryZone>();

  async upsert(zone: DeliveryZone): Promise<void> {
    this.zones.set(zone.zoneId, zone);
  }

  async list(): Promise<DeliveryZone[]> {
    return [...this.zones.values()];
  }
}
