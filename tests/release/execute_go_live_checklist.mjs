#!/usr/bin/env node

import fs from "node:fs";
import { execSync } from "node:child_process";

const [checklistPath, reportPath, mode] = process.argv.slice(2);

if (!checklistPath || !reportPath || !mode) {
  console.error(
    "Usage: node tests/release/execute_go_live_checklist.mjs <checklist.json> <report.json> <mode>"
  );
  process.exit(2);
}

const dryRun = mode === "dry-run";
if (!dryRun && mode !== "run") {
  console.error("mode must be either 'dry-run' or 'run'.");
  process.exit(2);
}

const checklist = JSON.parse(fs.readFileSync(checklistPath, "utf-8"));
const startedAt = new Date().toISOString();

const results = [];
let overallPass = true;

for (const gate of checklist.gates) {
  const gateStartMs = Date.now();

  if (dryRun) {
    results.push({
      gateId: gate.id,
      required: gate.required,
      command: gate.command,
      status: "SKIPPED_DRY_RUN",
      durationMs: Date.now() - gateStartMs,
      output: "Dry-run mode: command execution skipped."
    });
    continue;
  }

  try {
    const output = execSync(gate.command, {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true
    });

    results.push({
      gateId: gate.id,
      required: gate.required,
      command: gate.command,
      status: "PASS",
      durationMs: Date.now() - gateStartMs,
      output: truncate(output)
    });
  } catch (error) {
    const output =
      error instanceof Error && "stderr" in error
        ? `${String((error).stdout ?? "")}${String((error).stderr ?? "")}`
        : String(error);

    results.push({
      gateId: gate.id,
      required: gate.required,
      command: gate.command,
      status: "FAIL",
      durationMs: Date.now() - gateStartMs,
      output: truncate(output)
    });

    if (gate.required) {
      overallPass = false;
    }
  }
}

const report = {
  storyId: checklist.storyId,
  version: checklist.version,
  mode,
  startedAt,
  completedAt: new Date().toISOString(),
  summary: {
    total: results.length,
    passed: results.filter((entry) => entry.status === "PASS").length,
    failed: results.filter((entry) => entry.status === "FAIL").length,
    skippedDryRun: results.filter((entry) => entry.status === "SKIPPED_DRY_RUN").length,
    overallPass: dryRun ? true : overallPass
  },
  results
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

if (!dryRun && !overallPass) {
  process.exit(1);
}

function truncate(text) {
  if (typeof text !== "string") {
    return "";
  }

  const trimmed = text.trim();
  if (trimmed.length <= 5000) {
    return trimmed;
  }

  return `${trimmed.slice(0, 5000)}\n...[truncated]`;
}
