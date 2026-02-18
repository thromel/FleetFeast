import type { RiskPolicyRule } from "./types.js";

export class InMemoryRiskPolicyRepository {
  private readonly rules = new Map<string, RiskPolicyRule>();

  constructor(initialRules: RiskPolicyRule[] = defaultRiskPolicyRules) {
    for (const rule of initialRules) {
      this.rules.set(rule.actionType, rule);
    }
  }

  async findRule(actionType: string): Promise<RiskPolicyRule | null> {
    const rule = this.rules.get(actionType);
    return rule ? { ...rule } : null;
  }

  async upsertRule(rule: RiskPolicyRule): Promise<RiskPolicyRule> {
    const nextRule: RiskPolicyRule = { ...rule };
    this.rules.set(nextRule.actionType, nextRule);
    return { ...nextRule };
  }

  async listRules(): Promise<RiskPolicyRule[]> {
    return [...this.rules.values()]
      .map((rule) => ({ ...rule }))
      .sort((left, right) => left.actionType.localeCompare(right.actionType));
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
