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
