#!/usr/bin/env node

import fs from "node:fs";

const [casesPath] = process.argv.slice(2);

if (!casesPath) {
  console.error("Usage: node tests/security/check_audit_completeness.mjs <cases.json>");
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(casesPath, "utf-8"));
} catch (error) {
  console.error(`Unable to parse cases file ${casesPath}: ${String(error)}`);
  process.exit(1);
}

const errors = [];
const audit = payload.audit_completeness;
if (!audit || typeof audit !== "object") {
  console.error("Missing audit_completeness section in security cases.");
  process.exit(1);
}

const sourceFiles = Array.isArray(audit.sourceFiles) ? audit.sourceFiles : [];
const eventTypes = Array.isArray(audit.requiredEventTypes) ? audit.requiredEventTypes : [];
const fileContents = new Map();

for (const filePath of sourceFiles) {
  try {
    fileContents.set(filePath, fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    errors.push(`Unable to read source file ${filePath}: ${String(error)}`);
  }
}

for (const eventType of eventTypes) {
  const appearsIn = sourceFiles.filter((filePath) => {
    const content = fileContents.get(filePath);
    return typeof content === "string" && content.includes(eventType);
  });

  if (appearsIn.length === 0) {
    errors.push(`Required audit/security event type not found in sources: ${eventType}`);
  }
}

const contractDocument = audit.contractDocument;
if (typeof contractDocument !== "string" || contractDocument.trim().length === 0) {
  errors.push("audit_completeness.contractDocument must be defined.");
} else {
  try {
    const contractContent = fs.readFileSync(contractDocument, "utf-8");
    if (!contractContent.includes("AuditEvent")) {
      errors.push(`Contract document ${contractDocument} does not mention AuditEvent.`);
    }
  } catch (error) {
    errors.push(`Unable to read contract document ${contractDocument}: ${String(error)}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Audit completeness checks passed.");
