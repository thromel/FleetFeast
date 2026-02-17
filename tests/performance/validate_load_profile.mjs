#!/usr/bin/env node

import fs from "node:fs";

const [profilePath] = process.argv.slice(2);

if (!profilePath) {
  console.error("Usage: node tests/performance/validate_load_profile.mjs <profile.json>");
  process.exit(2);
}

const errors = [];
let profile;

try {
  profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
} catch (error) {
  console.error(`Unable to parse load profile ${profilePath}: ${String(error)}`);
  process.exit(1);
}

requireEquals(profile.storyId, "E12-S04", "storyId");
requireString(profile.scenarioName, "scenarioName");

const assumptions = profile.assumptions;
requireObject(assumptions, "assumptions");
requireNumberGte(assumptions?.mau, 1, "assumptions.mau");
requireNumberGte(assumptions?.dailyPeakOrders, 1000, "assumptions.dailyPeakOrders");
requireNumberGte(assumptions?.monthlyOrdersApprox, 18000, "assumptions.monthlyOrdersApprox");
requireNumberGte(assumptions?.targetAvailabilityPercent, 99.9, "assumptions.targetAvailabilityPercent");

const latencyBudgets = assumptions?.latencyBudgetsMs;
requireObject(latencyBudgets, "assumptions.latencyBudgetsMs");
requireNumberGte(latencyBudgets?.checkoutP95, 1, "assumptions.latencyBudgetsMs.checkoutP95");
requireNumberGte(latencyBudgets?.timelineP95, 1, "assumptions.latencyBudgetsMs.timelineP95");

const loadModel = profile.loadModel;
requireObject(loadModel, "loadModel");
requireNumberGte(loadModel?.durationMinutes, 1, "loadModel.durationMinutes");
requireNumberGte(loadModel?.peakVirtualUsers, 1, "loadModel.peakVirtualUsers");
requireNumberGte(loadModel?.peakRequestsPerSecond, 1, "loadModel.peakRequestsPerSecond");

if (!Array.isArray(loadModel?.phases) || loadModel.phases.length < 3) {
  errors.push("loadModel.phases must include at least three phases.");
} else {
  let phaseTotal = 0;
  loadModel.phases.forEach((phase, index) => {
    if (!phase || typeof phase !== "object") {
      errors.push(`loadModel.phases[${index}] must be an object.`);
      return;
    }

    requireString(phase.name, `loadModel.phases[${index}].name`);
    requireNumberGte(phase.durationMinutes, 1, `loadModel.phases[${index}].durationMinutes`);
    requireNumberGte(phase.startVUs, 0, `loadModel.phases[${index}].startVUs`);
    requireNumberGte(phase.targetVUs, 1, `loadModel.phases[${index}].targetVUs`);
    phaseTotal += Number(phase.durationMinutes ?? 0);
  });

  if (phaseTotal !== loadModel.durationMinutes) {
    errors.push(
      `loadModel.durationMinutes (${loadModel.durationMinutes}) must equal sum(phases.durationMinutes) (${phaseTotal}).`
    );
  }

  const lastPhase = loadModel.phases[loadModel.phases.length - 1];
  if (lastPhase && lastPhase.targetVUs !== loadModel.peakVirtualUsers) {
    errors.push(
      `Final phase targetVUs (${lastPhase.targetVUs}) must match loadModel.peakVirtualUsers (${loadModel.peakVirtualUsers}).`
    );
  }
}

const journeyMix = profile.journeyMix;
requireObject(journeyMix, "journeyMix");
requireNumberGte(journeyMix?.checkoutAndCreateOrder, 0, "journeyMix.checkoutAndCreateOrder");
requireNumberGte(journeyMix?.timelineRead, 0, "journeyMix.timelineRead");

if (isFiniteNumber(journeyMix?.checkoutAndCreateOrder) && isFiniteNumber(journeyMix?.timelineRead)) {
  const total = Number((journeyMix.checkoutAndCreateOrder + journeyMix.timelineRead).toFixed(6));
  if (total !== 1) {
    errors.push(`journeyMix values must sum to 1.0; received ${total}.`);
  }
}

const thresholds = profile.thresholds;
requireObject(thresholds, "thresholds");
requireString(thresholds?.["http_req_failed"], "thresholds.http_req_failed");
requireString(
  thresholds?.["http_req_duration{endpoint:checkout}"],
  "thresholds.http_req_duration{endpoint:checkout}"
);
requireString(
  thresholds?.["http_req_duration{endpoint:timeline}"],
  "thresholds.http_req_duration{endpoint:timeline}"
);
requireString(thresholds?.checks, "thresholds.checks");

if (
  thresholds?.["http_req_duration{endpoint:checkout}"] !==
  `p(95)<${latencyBudgets?.checkoutP95}`
) {
  errors.push(
    "thresholds.http_req_duration{endpoint:checkout} must align with assumptions.latencyBudgetsMs.checkoutP95."
  );
}

if (
  thresholds?.["http_req_duration{endpoint:timeline}"] !==
  `p(95)<${latencyBudgets?.timelineP95}`
) {
  errors.push(
    "thresholds.http_req_duration{endpoint:timeline} must align with assumptions.latencyBudgetsMs.timelineP95."
  );
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Load profile validated.");

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string.`);
  }
}

function requireEquals(value, expected, label) {
  if (value !== expected) {
    errors.push(`${label} must be '${expected}'.`);
  }
}

function requireNumberGte(value, minimum, label) {
  if (!isFiniteNumber(value) || value < minimum) {
    errors.push(`${label} must be a number >= ${minimum}.`);
  }
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
