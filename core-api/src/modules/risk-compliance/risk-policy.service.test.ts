import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryRiskPolicyRepository } from "./in-memory-risk-policy-repository.js";
import { RiskPolicyService } from "./risk-policy-service.js";

test("returns ALLOW decision when rule threshold is satisfied", async () => {
  const eventBus = new InMemoryEventBus();
  const repository = new InMemoryRiskPolicyRepository();
  const service = new RiskPolicyService(repository, eventBus);

  const decision = await service.evaluate({
    actionType: "REFUND_APPROVAL",
    amountCents: 500,
    actorId: "support-1",
  });

  assert.equal(decision.decision, "ALLOW");
  assert.equal(decision.reasonCode, "RULE_ALLOW");
});

test("returns REVIEW decision for medium-risk amount", async () => {
  const eventBus = new InMemoryEventBus();
  const repository = new InMemoryRiskPolicyRepository();
  const service = new RiskPolicyService(repository, eventBus);

  const decision = await service.evaluate({
    actionType: "REFUND_APPROVAL",
    amountCents: 3000,
    actorId: "support-1",
  });

  assert.equal(decision.decision, "REVIEW");
  assert.equal(decision.reasonCode, "RULE_REVIEW");
});

test("defaults to DENY for unknown policy path", async () => {
  const eventBus = new InMemoryEventBus();
  const repository = new InMemoryRiskPolicyRepository();
  const service = new RiskPolicyService(repository, eventBus);

  const decision = await service.evaluate({
    actionType: "UNKNOWN_ACTION",
    amountCents: 100,
    actorId: "support-1",
  });

  assert.equal(decision.decision, "DENY");
  assert.equal(decision.reasonCode, "UNKNOWN_POLICY_PATH");
  const event = eventBus.events.find((candidate) => candidate.type === "risk.policy_decision_made.v1");
  assert.ok(event);
});
