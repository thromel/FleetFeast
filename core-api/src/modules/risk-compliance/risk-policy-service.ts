import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryRiskPolicyRepository } from "./in-memory-risk-policy-repository.js";
import type {
  EvaluateRiskPolicyInput,
  RiskPolicyDecision,
  RiskPolicyDecisionType,
} from "./types.js";

export class RiskPolicyService {
  constructor(
    private readonly repository: InMemoryRiskPolicyRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async evaluate(input: EvaluateRiskPolicyInput): Promise<RiskPolicyDecision> {
    const rule = this.repository.findRule(input.actionType);
    const evaluatedAt = new Date().toISOString();

    let decision: RiskPolicyDecisionType;
    let reasonCode: string;

    if (!rule) {
      decision = "DENY";
      reasonCode = "UNKNOWN_POLICY_PATH";
    } else if (input.amountCents <= rule.allowUpToCents) {
      decision = "ALLOW";
      reasonCode = "RULE_ALLOW";
    } else if (input.amountCents <= rule.reviewUpToCents) {
      decision = "REVIEW";
      reasonCode = "RULE_REVIEW";
    } else {
      decision = "DENY";
      reasonCode = "RULE_DENY";
    }

    const policyDecision: RiskPolicyDecision = {
      decisionId: randomUUID(),
      actionType: input.actionType,
      amountCents: input.amountCents,
      actorId: input.actorId,
      decision,
      reasonCode,
      evaluatedAt,
    };

    this.eventBus.publish({
      type: "risk.policy_decision_made.v1",
      occurredAt: evaluatedAt,
      payload: {
        decisionId: policyDecision.decisionId,
        actionType: policyDecision.actionType,
        actorId: policyDecision.actorId,
        decision: policyDecision.decision,
        reasonCode: policyDecision.reasonCode,
      },
    });

    return policyDecision;
  }
}
