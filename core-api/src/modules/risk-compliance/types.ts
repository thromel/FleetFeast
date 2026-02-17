export type RiskPolicyDecisionType = "ALLOW" | "DENY" | "REVIEW";

export interface EvaluateRiskPolicyInput {
  actionType: string;
  amountCents: number;
  actorId: string;
}

export interface RiskPolicyRule {
  actionType: string;
  allowUpToCents: number;
  reviewUpToCents: number;
}

export interface RiskPolicyDecision {
  decisionId: string;
  actionType: string;
  amountCents: number;
  actorId: string;
  decision: RiskPolicyDecisionType;
  reasonCode: string;
  evaluatedAt: string;
}

export type ManualReviewEntityType = "REFUND" | "PAYOUT";
export type ManualReviewStatus = "QUEUED" | "APPROVED" | "REJECTED";
export type ManualReviewResolutionDecision = "APPROVE" | "REJECT";

export interface QueueManualReviewInput {
  entityType: ManualReviewEntityType;
  entityId: string;
  orderId?: string;
  amountCents: number;
  reasonCode: string;
  requestedBy: string;
}

export interface ResolveManualReviewInput {
  reviewId: string;
  decision: ManualReviewResolutionDecision;
  resolvedBy: string;
  note?: string;
}

export interface ManualReviewResolution {
  decision: ManualReviewResolutionDecision;
  resolvedBy: string;
  resolvedAt: string;
  note?: string;
}

export interface ManualReviewRecord {
  reviewId: string;
  entityType: ManualReviewEntityType;
  entityId: string;
  orderId?: string;
  amountCents: number;
  reasonCode: string;
  requestedBy: string;
  status: ManualReviewStatus;
  createdAt: string;
  updatedAt: string;
  resolution?: ManualReviewResolution;
}

export interface AppendComplianceAuditEventInput {
  actionType: string;
  actorId: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  metadata: Record<string, unknown>;
}

export interface ComplianceAuditEvent {
  auditEventId: string;
  actionType: string;
  actorId: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  previousHash: string;
  hash: string;
}

export interface GenerateComplianceEvidenceInput {
  generatedBy: string;
  generatedAt: string;
}

export interface ComplianceEvidenceReport {
  reportId: string;
  generatedBy: string;
  generatedAt: string;
  totalEvents: number;
  chainIntegrity: boolean;
  countByActionType: Record<string, number>;
}
