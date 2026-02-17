#!/usr/bin/env node

import fs from "node:fs";

const [baselinePath, candidatePath] = process.argv.slice(2);

if (!baselinePath || !candidatePath) {
  console.error(
    "Usage: node tests/contracts/scripts/protobuf_compat_check.mjs <baseline.proto> <candidate.proto>"
  );
  process.exit(2);
}

const errors = [];

const baselineSource = readFile(baselinePath, "baseline");
const candidateSource = readFile(candidatePath, "candidate");

if (baselineSource === null || candidateSource === null) {
  process.exit(1);
}

const baseline = parseProtoSchema(baselineSource, "baseline");
const candidate = parseProtoSchema(candidateSource, "candidate");

if (!baseline || !candidate) {
  process.exit(1);
}

checkCompatibility(baseline, candidate);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

process.exit(0);

function addError(message) {
  errors.push(message);
}

function readFile(path, label) {
  try {
    return fs.readFileSync(path, "utf-8");
  } catch (error) {
    addError(`Unable to read ${label} proto file at ${path}: ${String(error)}`);
    return null;
  }
}

function parseProtoSchema(source, label) {
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  const syntaxMatch = clean.match(/syntax\s*=\s*"([^"]+)"\s*;/);
  if (!syntaxMatch) {
    addError(`${label} proto is missing syntax declaration.`);
  }

  const packageMatch = clean.match(/package\s+([a-zA-Z_][\w.]*)\s*;/);
  if (!packageMatch) {
    addError(`${label} proto is missing package declaration.`);
  }

  const services = parseServices(clean, label);
  const messages = parseMessages(clean, label);

  return {
    syntax: syntaxMatch?.[1] ?? null,
    packageName: packageMatch?.[1] ?? null,
    services,
    messages
  };
}

function parseServices(source, label) {
  const services = new Map();
  const serviceRegex = /service\s+([A-Za-z_][\w]*)\s*\{([\s\S]*?)\}/g;
  let serviceMatch;

  while ((serviceMatch = serviceRegex.exec(source)) !== null) {
    const serviceName = serviceMatch[1];
    const body = serviceMatch[2];

    const methods = new Map();
    const rpcRegex = /rpc\s+([A-Za-z_][\w]*)\s*\(\s*([A-Za-z_][\w.]*)\s*\)\s*returns\s*\(\s*([A-Za-z_][\w.]*)\s*\)\s*;/g;
    let rpcMatch;

    while ((rpcMatch = rpcRegex.exec(body)) !== null) {
      methods.set(rpcMatch[1], {
        requestType: rpcMatch[2],
        responseType: rpcMatch[3]
      });
    }

    if (methods.size === 0) {
      addError(`${label} service ${serviceName} must define at least one rpc method.`);
    }

    services.set(serviceName, methods);
  }

  if (services.size === 0) {
    addError(`${label} proto must define at least one service.`);
  }

  return services;
}

function parseMessages(source, label) {
  const messages = new Map();
  const messageRegex = /message\s+([A-Za-z_][\w]*)\s*\{([\s\S]*?)\}/g;
  let messageMatch;

  while ((messageMatch = messageRegex.exec(source)) !== null) {
    const messageName = messageMatch[1];
    const body = messageMatch[2];

    const byNumber = new Map();
    const byName = new Map();
    const lines = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (line.startsWith("option ") || line.startsWith("reserved ")) {
        continue;
      }

      const fieldMatch = line.match(
        /^(?:repeated\s+|optional\s+|required\s+)?([A-Za-z_][\w<>.,]*)\s+([A-Za-z_][\w]*)\s*=\s*(\d+)\s*(?:\[[^\]]*\])?;/
      );

      if (!fieldMatch) {
        continue;
      }

      const fieldType = fieldMatch[1];
      const fieldName = fieldMatch[2];
      const fieldNumber = Number(fieldMatch[3]);

      if (byNumber.has(fieldNumber)) {
        addError(
          `${label} message ${messageName} has duplicate field number ${fieldNumber}.`
        );
        continue;
      }

      if (byName.has(fieldName)) {
        addError(`${label} message ${messageName} has duplicate field name ${fieldName}.`);
        continue;
      }

      const field = {
        name: fieldName,
        type: normalizeType(fieldType),
        number: fieldNumber
      };

      byNumber.set(fieldNumber, field);
      byName.set(fieldName, field);
    }

    messages.set(messageName, {
      byNumber,
      byName
    });
  }

  if (messages.size === 0) {
    addError(`${label} proto must define at least one message.`);
  }

  return messages;
}

function checkCompatibility(baseline, candidate) {
  if (baseline.syntax !== candidate.syntax) {
    addError(
      `Candidate proto changed syntax declaration (${String(baseline.syntax)} -> ${String(candidate.syntax)}).`
    );
  }

  if (baseline.packageName !== candidate.packageName) {
    addError(
      `Candidate proto changed package (${String(baseline.packageName)} -> ${String(candidate.packageName)}).`
    );
  }

  for (const [serviceName, baselineMethods] of baseline.services.entries()) {
    const candidateMethods = candidate.services.get(serviceName);
    if (!candidateMethods) {
      addError(`Candidate proto removed service ${serviceName}.`);
      continue;
    }

    for (const [methodName, baselineMethod] of baselineMethods.entries()) {
      const candidateMethod = candidateMethods.get(methodName);
      if (!candidateMethod) {
        addError(`Candidate proto removed rpc ${serviceName}.${methodName}.`);
        continue;
      }

      if (candidateMethod.requestType !== baselineMethod.requestType) {
        addError(
          `Candidate proto changed request type for ${serviceName}.${methodName} (${baselineMethod.requestType} -> ${candidateMethod.requestType}).`
        );
      }

      if (candidateMethod.responseType !== baselineMethod.responseType) {
        addError(
          `Candidate proto changed response type for ${serviceName}.${methodName} (${baselineMethod.responseType} -> ${candidateMethod.responseType}).`
        );
      }
    }
  }

  for (const [messageName, baselineMessage] of baseline.messages.entries()) {
    const candidateMessage = candidate.messages.get(messageName);
    if (!candidateMessage) {
      addError(`Candidate proto removed message ${messageName}.`);
      continue;
    }

    for (const [fieldNumber, baselineField] of baselineMessage.byNumber.entries()) {
      const candidateField = candidateMessage.byNumber.get(fieldNumber);
      if (!candidateField) {
        addError(
          `Candidate proto removed field #${fieldNumber} (${baselineField.name}) from message ${messageName}.`
        );
        continue;
      }

      if (candidateField.name !== baselineField.name) {
        addError(
          `Candidate proto reused field #${fieldNumber} in message ${messageName} (${baselineField.name} -> ${candidateField.name}).`
        );
      }

      if (candidateField.type !== baselineField.type) {
        addError(
          `Candidate proto changed type of ${messageName}.${baselineField.name} (#${fieldNumber}) (${baselineField.type} -> ${candidateField.type}).`
        );
      }
    }

    for (const [fieldName, baselineField] of baselineMessage.byName.entries()) {
      const candidateField = candidateMessage.byName.get(fieldName);
      if (!candidateField) {
        addError(`Candidate proto removed field ${messageName}.${fieldName}.`);
        continue;
      }

      if (candidateField.number !== baselineField.number) {
        addError(
          `Candidate proto changed field number for ${messageName}.${fieldName} (${baselineField.number} -> ${candidateField.number}).`
        );
      }
    }
  }
}

function normalizeType(type) {
  return type.replace(/\s+/g, " ").trim();
}
