import { InMemoryDeliveryZoneRepository } from "../../../modules/consumer-ordering/in-memory-delivery-zone-repository.js";
import type { DeliveryZone } from "../../../modules/consumer-ordering/delivery-zone-types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "ordering.delivery_zones";

export class PersistentDeliveryZoneRepository extends InMemoryDeliveryZoneRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async upsert(zone: DeliveryZone): Promise<void> {
    await super.upsert({ ...zone });
    await this.store.put(NAMESPACE, zone.zoneId, { ...zone });
  }

  override async list(): Promise<DeliveryZone[]> {
    const zones = await this.store.list<DeliveryZone>(NAMESPACE);
    return zones.map((zone) => ({ ...zone }));
  }
}
