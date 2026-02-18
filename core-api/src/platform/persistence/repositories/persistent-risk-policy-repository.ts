import { InMemoryRiskPolicyRepository } from "../../../modules/risk-compliance/in-memory-risk-policy-repository.js";
import type { RiskPolicyRule } from "../../../modules/risk-compliance/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "risk.policy_rules";

export class PersistentRiskPolicyRepository extends InMemoryRiskPolicyRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async findRule(actionType: string): Promise<RiskPolicyRule | null> {
    const persisted = await this.store.get<RiskPolicyRule>(NAMESPACE, actionType);
    if (persisted) {
      return { ...persisted };
    }

    return super.findRule(actionType);
  }

  override async upsertRule(rule: RiskPolicyRule): Promise<RiskPolicyRule> {
    const nextRule = await super.upsertRule({ ...rule });
    await this.store.put(NAMESPACE, nextRule.actionType, { ...nextRule });
    return { ...nextRule };
  }

  override async listRules(): Promise<RiskPolicyRule[]> {
    const defaults = await super.listRules();
    const persisted = await this.store.list<RiskPolicyRule>(NAMESPACE);

    const rulesByActionType = new Map<string, RiskPolicyRule>();
    for (const rule of defaults) {
      rulesByActionType.set(rule.actionType, { ...rule });
    }
    for (const rule of persisted) {
      rulesByActionType.set(rule.actionType, { ...rule });
    }

    return [...rulesByActionType.values()].sort((left, right) =>
      left.actionType.localeCompare(right.actionType),
    );
  }
}
