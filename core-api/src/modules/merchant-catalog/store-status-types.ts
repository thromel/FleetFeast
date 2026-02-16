export interface StoreSchedule {
  open: string;
  close: string;
  timezone: string;
}

export interface StoreStatus {
  storeId: string;
  paused: boolean;
  schedule: StoreSchedule;
  updatedAt: string;
}

export type OrderabilityReason =
  | "OK"
  | "STORE_PAUSED"
  | "OUTSIDE_STORE_HOURS"
  | "STORE_STATUS_NOT_CONFIGURED";

export interface StoreOrderability {
  orderable: boolean;
  reason: OrderabilityReason;
  evaluatedAt: string;
}

export interface UpdateStoreStatusInput {
  paused: boolean;
  schedule: StoreSchedule;
}
