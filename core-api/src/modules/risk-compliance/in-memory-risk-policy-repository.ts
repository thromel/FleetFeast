import type { RiskPolicyRule } from "./types.js";

export class InMemoryRiskPolicyRepository {
  private readonly rules = new Map<string, RiskPolicyRule>();

  constructor(initialRules: RiskPolicyRule[] = defaultRiskPolicyRules) {
    for (const rule of initialRules) {
      this.rules.set(rule.actionType, rule);
    }
  }

  findRule(actionType: string): RiskPolicyRule | null {
    return this.rules.get(actionType) ?? null;
  }
}

const defaultRiskPolicyRules: RiskPolicyRule[] = [
  {
    actionType: "REFUND_APPROVAL",
    allowUpToCents: 1_000,
    reviewUpToCents: 5_000,
  },
  {
    actionType: "PAYOUT_RELEASE",
    allowUpToCents: 5_000,
    reviewUpToCents: 20_000,
  },
  {
    actionType: "ORDER_CANCEL",
    allowUpToCents: Number.MAX_SAFE_INTEGER,
    reviewUpToCents: Number.MAX_SAFE_INTEGER,
  },
];
