#!/usr/bin/env node

import fs from "node:fs";

const [modeledPath, observedPath] = process.argv.slice(2);

if (!modeledPath || !observedPath) {
  console.error(
    "Usage: node tests/cost/validate_cost_model_inputs.mjs <modeled.json> <observed.json>"
  );
  process.exit(2);
}

const errors = [];
const modeled = readJson(modeledPath, "modeled");
const observed = readJson(observedPath, "observed");

if (!modeled || !observed) {
  process.exit(1);
}

expectString(modeled.storyId, "modeled.storyId");
if (modeled.storyId !== "E12-S07") {
  errors.push("modeled.storyId must be E12-S07.");
}
expectString(modeled.stage, "modeled.stage");
expectNumberGte(modeled.modeledOrdersMonthly, 1, "modeled.modeledOrdersMonthly");
expectNumberGte(modeled.modeledTotalMonthlyCostUsd, 1, "modeled.modeledTotalMonthlyCostUsd");
expectObject(modeled.costBreakdownUsd, "modeled.costBreakdownUsd");

expectString(observed.period, "observed.period");
expectNumberGte(observed.ordersProcessed, 1, "observed.ordersProcessed");
expectNumberGte(observed.observedTotalMonthlyCostUsd, 1, "observed.observedTotalMonthlyCostUsd");
expectObject(observed.observedCostBreakdownUsd, "observed.observedCostBreakdownUsd");

const modeledSum = sumValues(modeled.costBreakdownUsd);
if (Math.abs(modeledSum - modeled.modeledTotalMonthlyCostUsd) > 0.01) {
  errors.push(
    `modeled.costBreakdownUsd must sum to modeledTotalMonthlyCostUsd (${modeled.modeledTotalMonthlyCostUsd}); got ${modeledSum}.`
  );
}

const observedSum = sumValues(observed.observedCostBreakdownUsd);
if (Math.abs(observedSum - observed.observedTotalMonthlyCostUsd) > 0.01) {
  errors.push(
    `observed.observedCostBreakdownUsd must sum to observedTotalMonthlyCostUsd (${observed.observedTotalMonthlyCostUsd}); got ${observedSum}.`
  );
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Cost model inputs validated.");

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    errors.push(`Unable to parse ${label} JSON (${filePath}): ${String(error)}`);
    return null;
  }
}

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

function sumValues(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return NaN;
  }

  return Object.values(obj).reduce((total, value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`Cost breakdown contains non-numeric value: ${String(value)}`);
      return total;
    }
    return total + value;
  }, 0);
}
