#!/usr/bin/env node

import fs from "node:fs";

const [checklistPath] = process.argv.slice(2);

if (!checklistPath) {
  console.error("Usage: node tests/release/validate_go_live_checklist.mjs <checklist.json>");
  process.exit(2);
}

const errors = [];
let payload;

try {
  payload = JSON.parse(fs.readFileSync(checklistPath, "utf-8"));
} catch (error) {
  console.error(`Unable to parse checklist ${checklistPath}: ${String(error)}`);
  process.exit(1);
}

if (payload.storyId !== "E12-S08") {
  errors.push("storyId must be E12-S08.");
}

if (typeof payload.version !== "string" || payload.version.trim().length === 0) {
  errors.push("version must be a non-empty string.");
}

if (!Array.isArray(payload.gates) || payload.gates.length === 0) {
  errors.push("gates must be a non-empty array.");
} else {
  const requiredGateIds = [
    "contracts_gate",
    "performance_gate",
    "resilience_gate",
    "security_gate",
    "cost_gate"
  ];

  const seenIds = new Set();
  for (const [index, gate] of payload.gates.entries()) {
    if (!gate || typeof gate !== "object") {
      errors.push(`gates[${index}] must be an object.`);
      continue;
    }

    if (typeof gate.id !== "string" || gate.id.trim().length === 0) {
      errors.push(`gates[${index}].id must be a non-empty string.`);
    } else {
      if (seenIds.has(gate.id)) {
        errors.push(`Duplicate gate id: ${gate.id}`);
      }
      seenIds.add(gate.id);
    }

    if (typeof gate.description !== "string" || gate.description.trim().length === 0) {
      errors.push(`gates[${index}].description must be a non-empty string.`);
    }

    if (typeof gate.required !== "boolean") {
      errors.push(`gates[${index}].required must be boolean.`);
    }

    if (typeof gate.command !== "string" || gate.command.trim().length === 0) {
      errors.push(`gates[${index}].command must be a non-empty string.`);
    }
  }

  for (const gateId of requiredGateIds) {
    if (!seenIds.has(gateId)) {
      errors.push(`Missing required gate id '${gateId}'.`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Go-live checklist validated.");
