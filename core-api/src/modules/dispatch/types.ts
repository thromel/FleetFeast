export type CourierJobStatus = "AVAILABLE" | "ACCEPTED" | "PICKED_UP" | "DROPPED_OFF";

export interface CourierJob {
  jobId: string;
  orderId: string;
  status: CourierJobStatus;
  courierId: string | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  droppedOffAt: string | null;
}
