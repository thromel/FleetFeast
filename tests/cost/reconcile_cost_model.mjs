#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [modeledPath, observedPath, alarmConfigPath, outputPath] = process.argv.slice(2);

if (!modeledPath || !observedPath || !alarmConfigPath || !outputPath) {
  console.error(
    "Usage: node tests/cost/reconcile_cost_model.mjs <modeled.json> <observed.json> <alarm-config.json> <output.json>"
  );
  process.exit(2);
}

const modeled = JSON.parse(fs.readFileSync(modeledPath, "utf-8"));
const observed = JSON.parse(fs.readFileSync(observedPath, "utf-8"));
const alarmConfig = JSON.parse(fs.readFileSync(alarmConfigPath, "utf-8"));

const varianceThreshold = alarmConfig.varianceThresholdPercent;
const unitEconomicsThreshold = alarmConfig.unitEconomicsDriftPercent;

const totalVariancePercent = percentDelta(
  modeled.modeledTotalMonthlyCostUsd,
  observed.observedTotalMonthlyCostUsd
);

const modeledCostPerOrder = modeled.modeledTotalMonthlyCostUsd / modeled.modeledOrdersMonthly;
const observedCostPerOrder = observed.observedTotalMonthlyCostUsd / observed.ordersProcessed;
const unitEconomicsDriftPercent = percentDelta(modeledCostPerOrder, observedCostPerOrder);

const categoryVariance = {};
for (const [key, modeledCost] of Object.entries(modeled.costBreakdownUsd)) {
  const observedCost = observed.observedCostBreakdownUsd[key] ?? 0;
  categoryVariance[key] = {
    modeledCost,
    observedCost,
    variancePercent: percentDelta(modeledCost, observedCost)
  };
}

const report = {
  storyId: modeled.storyId,
  stage: modeled.stage,
  period: observed.period,
  generatedAt: new Date().toISOString(),
  thresholds: {
    varianceThresholdPercent: varianceThreshold,
    unitEconomicsDriftPercent: unitEconomicsThreshold
  },
  totals: {
    modeledTotalMonthlyCostUsd: modeled.modeledTotalMonthlyCostUsd,
    observedTotalMonthlyCostUsd: observed.observedTotalMonthlyCostUsd,
    totalVariancePercent
  },
  unitEconomics: {
    modeledCostPerOrder,
    observedCostPerOrder,
    unitEconomicsDriftPercent
  },
  categoryVariance,
  verdict: {
    costVarianceWithinThreshold: Math.abs(totalVariancePercent) <= varianceThreshold,
    unitEconomicsWithinThreshold:
      Math.abs(unitEconomicsDriftPercent) <= unitEconomicsThreshold
  }
};

report.verdict.pass =
  report.verdict.costVarianceWithinThreshold && report.verdict.unitEconomicsWithinThreshold;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");

if (!report.verdict.pass) {
  process.exit(1);
}

console.log(`Cost reconciliation passed. Report: ${outputPath}`);

function percentDelta(modeledValue, observedValue) {
  if (typeof modeledValue !== "number" || modeledValue === 0) {
    return 0;
  }

  return Number((((observedValue - modeledValue) / modeledValue) * 100).toFixed(2));
}
