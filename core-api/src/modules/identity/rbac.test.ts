import assert from "node:assert/strict";
import test from "node:test";

import { isAllowed } from "./rbac.js";

test("consumer role cannot access admin scope", () => {
  assert.equal(isAllowed("consumer", "admin:read"), false);
});

test("system_admin role can access admin scope", () => {
  assert.equal(isAllowed("system_admin", "admin:read"), true);
});

test("support_agent can execute support interventions", () => {
  assert.equal(isAllowed("support_agent", "support:intervene"), true);
});
