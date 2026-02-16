import { InMemoryDeliveryZoneRepository } from "./in-memory-delivery-zone-repository.js";
import type {
  DeliveryZone,
  DeliveryZoneAlternative,
  UpsertDeliveryZoneInput,
  ValidateZonePointInput,
  ValidateZoneResult,
} from "./delivery-zone-types.js";

function isInside(zone: DeliveryZone, latitude: number, longitude: number): boolean {
  return (
    latitude >= zone.minLat &&
    latitude <= zone.maxLat &&
    longitude >= zone.minLng &&
    longitude <= zone.maxLng
  );
}

function center(zone: DeliveryZone): { latitude: number; longitude: number } {
  return {
    latitude: (zone.minLat + zone.maxLat) / 2,
    longitude: (zone.minLng + zone.maxLng) / 2,
  };
}

function distanceScore(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const dLat = from.latitude - to.latitude;
  const dLng = from.longitude - to.longitude;
  return Number(Math.sqrt(dLat * dLat + dLng * dLng).toFixed(6));
}

export class DeliveryZoneService {
  constructor(private readonly repository: InMemoryDeliveryZoneRepository) {}

  async upsertZone(input: UpsertDeliveryZoneInput): Promise<DeliveryZone> {
    const zone: DeliveryZone = {
      zoneId: input.zoneId,
      name: input.name,
      minLat: input.minLat,
      maxLat: input.maxLat,
      minLng: input.minLng,
      maxLng: input.maxLng,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.upsert(zone);
    return zone;
  }

  async validatePoint(input: ValidateZonePointInput): Promise<ValidateZoneResult> {
    const zones = await this.repository.list();

    const matched = zones.find((zone) => isInside(zone, input.latitude, input.longitude));
    if (matched) {
      return {
        serviceable: true,
        zoneId: matched.zoneId,
        alternatives: [],
      };
    }

    const alternatives: DeliveryZoneAlternative[] = zones
      .map((zone) => {
        const zoneCenter = center(zone);
        return {
          zoneId: zone.zoneId,
          name: zone.name,
          distanceScore: distanceScore(
            { latitude: input.latitude, longitude: input.longitude },
            zoneCenter,
          ),
        };
      })
      .sort((left, right) => left.distanceScore - right.distanceScore)
      .slice(0, 3);

    return {
      serviceable: false,
      reason: "OUT_OF_ZONE",
      alternatives,
    };
  }
}
