export interface ItemAvailabilityRecord {
  itemId: string;
  available: boolean;
  reason: string | null;
  updatedAt: string;
}

export interface UpdateItemAvailabilityInput {
  available: boolean;
  reason?: string;
}
