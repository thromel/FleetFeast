#!/usr/bin/env node

import fs from "node:fs";

const [casesPath] = process.argv.slice(2);

if (!casesPath) {
  console.error("Usage: node tests/security/validate_security_cases.mjs <cases.json>");
  process.exit(2);
}

const errors = [];
let payload;

try {
  payload = JSON.parse(fs.readFileSync(casesPath, "utf-8"));
} catch (error) {
  console.error(`Unable to parse security cases file ${casesPath}: ${String(error)}`);
  process.exit(1);
}

expectString(payload.storyId, "storyId");
if (payload.storyId !== "E12-S06") {
  errors.push("storyId must be E12-S06.");
}
expectString(payload.suiteVersion, "suiteVersion");

expectObject(payload.authz_boundaries, "authz_boundaries");
expectString(payload.authz_boundaries?.requiredErrorCode, "authz_boundaries.requiredErrorCode");
expectStringArray(payload.authz_boundaries?.testFiles, "authz_boundaries.testFiles");

expectObject(payload.audit_completeness, "audit_completeness");
expectStringArray(payload.audit_completeness?.routeTestFiles, "audit_completeness.routeTestFiles");
expectStringArray(
  payload.audit_completeness?.requiredEventTypes,
  "audit_completeness.requiredEventTypes"
);
expectStringArray(payload.audit_completeness?.sourceFiles, "audit_completeness.sourceFiles");
expectString(payload.audit_completeness?.contractDocument, "audit_completeness.contractDocument");

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Security verification cases validated.");

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

function expectStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty string array.`);
    return;
  }

  value.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      errors.push(`${label}[${index}] must be a non-empty string.`);
    }
  });
}
