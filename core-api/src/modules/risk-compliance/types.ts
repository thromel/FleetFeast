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
