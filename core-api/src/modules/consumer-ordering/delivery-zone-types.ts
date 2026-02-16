export interface DeliveryZone {
  zoneId: string;
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  updatedAt: string;
}

export interface UpsertDeliveryZoneInput {
  zoneId: string;
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ValidateZonePointInput {
  latitude: number;
  longitude: number;
}

export interface DeliveryZoneAlternative {
  zoneId: string;
  name: string;
  distanceScore: number;
}

export interface ValidateZoneResult {
  serviceable: boolean;
  zoneId?: string;
  reason?: "OUT_OF_ZONE";
  alternatives: DeliveryZoneAlternative[];
}
