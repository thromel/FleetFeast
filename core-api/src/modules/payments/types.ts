export type PaymentMethod = "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "CASH";

export type PaymentStatus = "INITIATED" | "AUTHORIZED" | "CAPTURED" | "VOIDED" | "REFUNDED";

export interface PaymentIntent {
  paymentIntentId: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizePaymentInput {
  orderId: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
}

export interface CapturePaymentInput {
  paymentIntentId: string;
  idempotencyKey: string;
}

export interface MarkCashExpectedInput {
  orderId: string;
  expectedAmount: number;
  currency: string;
}

export interface ConfirmCashCollectionInput {
  orderId: string;
  collectedAmount: number;
  courierId: string;
}

export interface CashCollectionResult {
  orderId: string;
  expectedAmount: number;
  collectedAmount: number;
  courierId: string;
  mismatch: boolean;
}

export type RefundStatus = "REQUESTED" | "APPROVED" | "DECLINED" | "COMPLETED";

export interface RefundRequest {
  refundRequestId: string;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  reasonCode: string;
  status: RefundStatus;
  requestedBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestRefundInput {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  reasonCode: string;
  requestedBy: string;
}

export interface ApproveRefundInput {
  refundRequestId: string;
  approvedBy: string;
}

export interface PaymentAuditRecord {
  auditEventId: string;
  orderId: string;
  actionType: string;
  targetId: string;
  reasonCode: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface PSPAuthorizeRequest {
  orderId: string;
  method: Exclude<PaymentMethod, "CASH">;
  amount: number;
  currency: string;
}

export interface PSPAuthorizeResponse {
  providerReference: string;
  authorizedAt: string;
}
