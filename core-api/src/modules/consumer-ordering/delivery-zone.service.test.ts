import assert from "node:assert/strict";
import test from "node:test";

import { DeliveryZoneService } from "./delivery-zone-service.js";
import { InMemoryDeliveryZoneRepository } from "./in-memory-delivery-zone-repository.js";

test("returns serviceable when point is inside a delivery zone", async () => {
  const repo = new InMemoryDeliveryZoneRepository();
  const service = new DeliveryZoneService(repo);

  await service.upsertZone({
    zoneId: "zone-a",
    name: "Downtown",
    minLat: 40.7000,
    maxLat: 40.8000,
    minLng: -74.0500,
    maxLng: -73.9000,
  });

  const result = await service.validatePoint({ latitude: 40.7500, longitude: -73.9800 });

  assert.equal(result.serviceable, true);
  assert.equal(result.zoneId, "zone-a");
});

test("returns out of zone with alternatives when point is outside", async () => {
  const repo = new InMemoryDeliveryZoneRepository();
  const service = new DeliveryZoneService(repo);

  await service.upsertZone({
    zoneId: "zone-a",
    name: "Downtown",
    minLat: 40.7000,
    maxLat: 40.8000,
    minLng: -74.0500,
    maxLng: -73.9000,
  });

  await service.upsertZone({
    zoneId: "zone-b",
    name: "Uptown",
    minLat: 40.8200,
    maxLat: 40.9200,
    minLng: -74.0000,
    maxLng: -73.9000,
  });

  const result = await service.validatePoint({ latitude: 40.6000, longitude: -73.8000 });

  assert.equal(result.serviceable, false);
  assert.equal(result.reason, "OUT_OF_ZONE");
  assert.equal(result.alternatives.length > 0, true);
});
