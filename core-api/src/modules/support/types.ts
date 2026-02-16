import type { OrderTimelineEntry } from "../order-orchestration/timeline-types.js";
import type { PaymentAuditRecord } from "../payments/types.js";

export type SupportTicketStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED";

export interface SupportTicket {
  ticketId: string;
  orderId: string;
  actorId: string;
  issueType: string;
  summary: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportTicketInput {
  orderId: string;
  actorId: string;
  issueType: string;
  summary: string;
}

export type SupportTimelineSourceType = "ORDER_TIMELINE" | "PAYMENT_AUDIT";

export interface SupportTimelineEntry {
  sourceType: SupportTimelineSourceType;
  referenceId: string;
  eventType: string;
  occurredAt: string;
  details: Record<string, unknown>;
}

export interface SupportTicketTimelineView {
  ticket: SupportTicket;
  entries: SupportTimelineEntry[];
}

export interface SupportCorrelationSources {
  getOrderTimeline(orderId: string): OrderTimelineEntry[];
  getPaymentAudit(orderId: string): Promise<PaymentAuditRecord[]>;
}

export type SupportInterventionActionType =
  | "CANCEL_ORDER"
  | "REFUND_PAYMENT"
  | "REASSIGN_COURIER";

export interface ExecuteSupportInterventionInput {
  actionType: SupportInterventionActionType;
  actorId: string;
  orderId: string;
  reasonCode: string;
  paymentIntentId?: string;
  refundAmount?: number;
}

export interface SupportInterventionResult {
  actionType: SupportInterventionActionType;
  status: "COMPLETED" | "QUEUED";
  result: Record<string, unknown>;
}

export interface SupportEscalationRecord {
  escalationId: string;
  ticketId: string;
  orderId: string;
  issueType: string;
  escalatedAt: string;
  reasonCode: string;
}

export interface EvaluateSupportSLAInput {
  evaluatedAt: string;
}

export interface SupportSLAEvaluationResult {
  evaluatedAt: string;
  escalations: SupportEscalationRecord[];
}
