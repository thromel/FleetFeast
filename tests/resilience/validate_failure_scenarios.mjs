#!/usr/bin/env node

import fs from "node:fs";

const [scenarioPath] = process.argv.slice(2);

if (!scenarioPath) {
  console.error("Usage: node tests/resilience/validate_failure_scenarios.mjs <scenarios.json>");
  process.exit(2);
}

let payload;
const errors = [];

try {
  payload = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));
} catch (error) {
  console.error(`Unable to parse scenario file ${scenarioPath}: ${String(error)}`);
  process.exit(1);
}

expectString(payload.storyId, "storyId");
if (payload.storyId !== "E12-S05") {
  errors.push("storyId must be E12-S05.");
}

expectString(payload.suiteVersion, "suiteVersion");
expectObject(payload.globalCriteria, "globalCriteria");
expectNumberGte(payload.globalCriteria?.maxDataLossSeconds, 1, "globalCriteria.maxDataLossSeconds");
expectNumberGte(payload.globalCriteria?.maxRecoverySeconds, 1, "globalCriteria.maxRecoverySeconds");
if (typeof payload.globalCriteria?.evidenceRequired !== "boolean") {
  errors.push("globalCriteria.evidenceRequired must be boolean.");
}

if (!Array.isArray(payload.scenarios) || payload.scenarios.length < 3) {
  errors.push("scenarios must contain at least three scenarios.");
} else {
  const requiredScenarioIds = new Set(["queue_lag", "db_failover", "provider_outage"]);
  const seenIds = new Set();

  payload.scenarios.forEach((scenario, index) => {
    if (!scenario || typeof scenario !== "object") {
      errors.push(`scenarios[${index}] must be an object.`);
      return;
    }

    expectString(scenario.id, `scenarios[${index}].id`);
    expectString(scenario.description, `scenarios[${index}].description`);
    expectObject(scenario.inject, `scenarios[${index}].inject`);
    expectString(scenario.inject?.type, `scenarios[${index}].inject.type`);
    expectNumberGte(
      scenario.inject?.durationSeconds,
      1,
      `scenarios[${index}].inject.durationSeconds`
    );

    if (!Array.isArray(scenario.successCriteria) || scenario.successCriteria.length === 0) {
      errors.push(`scenarios[${index}].successCriteria must be a non-empty array.`);
    }

    if (!Array.isArray(scenario.expectedAlerts) || scenario.expectedAlerts.length === 0) {
      errors.push(`scenarios[${index}].expectedAlerts must be a non-empty array.`);
    }

    expectNumberGte(scenario.maxRecoverySeconds, 1, `scenarios[${index}].maxRecoverySeconds`);

    if (typeof scenario.id === "string") {
      if (seenIds.has(scenario.id)) {
        errors.push(`Duplicate scenario id: ${scenario.id}`);
      }
      seenIds.add(scenario.id);
    }
  });

  for (const requiredId of requiredScenarioIds) {
    if (!seenIds.has(requiredId)) {
      errors.push(`Missing required scenario id '${requiredId}'.`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Failure scenarios validated.");

function expectObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
  }
}

function expectString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string.`);
  }
}

function expectNumberGte(value, minimum, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    errors.push(`${label} must be a number >= ${minimum}.`);
  }
}
