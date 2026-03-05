import assert from "node:assert/strict";
import test from "node:test";

import { buildCourierDemoState } from "./demo-state";

test("buildCourierDemoState preserves follow-up actions after accept when no available jobs remain", () => {
  const state = buildCourierDemoState({
    jobs: [],
    lastJobId: "job-1",
    lastStatus: "ACCEPTED",
  });

  assert.equal(state.primaryJob, null);
  assert.equal(state.followUpJobId, "job-1");
  assert.equal(state.followUpStatus, "ACCEPTED");
  assert.equal(state.canPickupFollowUp, true);
  assert.equal(state.canDropoffFollowUp, false);
});

test("buildCourierDemoState enables dropoff continuation after pickup", () => {
  const state = buildCourierDemoState({
    jobs: [],
    lastJobId: "job-1",
    lastStatus: "PICKED_UP",
  });

  assert.equal(state.followUpJobId, "job-1");
  assert.equal(state.followUpStatus, "PICKED_UP");
  assert.equal(state.canPickupFollowUp, false);
  assert.equal(state.canDropoffFollowUp, true);
});
