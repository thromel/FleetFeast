export type OrderStatus =
  | "CREATED"
  | "MERCHANT_ACCEPTED"
  | "DISPATCH_PENDING"
  | "COURIER_ASSIGNED"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED";

export interface Order {
  id: string;
  checkoutId: string;
  quoteHash: string;
  consumerId: string | null;
  merchantId: string | null;
  courierId: string | null;
  status: OrderStatus;
  cancellationReason: string | null;
  cancelledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  checkoutId: string;
  quoteHash: string;
}

export type CancellationActor = "consumer" | "merchant_operator" | "support_agent" | "system_admin";

export interface RequestCancellationInput {
  actor: CancellationActor;
  reasonCode: string;
}
