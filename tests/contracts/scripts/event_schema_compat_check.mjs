#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [baselineDir, candidateDir] = process.argv.slice(2);

if (!baselineDir || !candidateDir) {
  console.error(
    "Usage: node tests/contracts/scripts/event_schema_compat_check.mjs <baseline-dir> <candidate-dir>"
  );
  process.exit(2);
}

const errors = [];

const baselineSchemas = loadSchemaDirectory(baselineDir, "baseline");
const candidateSchemas = loadSchemaDirectory(candidateDir, "candidate");

if (!baselineSchemas || !candidateSchemas) {
  process.exit(1);
}

for (const [fileName, baselineSchema] of baselineSchemas.entries()) {
  const candidateSchema = candidateSchemas.get(fileName);
  if (!candidateSchema) {
    addError(`Candidate event schemas removed file ${fileName}.`);
    continue;
  }

  validateEventEnvelope("baseline", fileName, baselineSchema);
  validateEventEnvelope("candidate", fileName, candidateSchema);
  compareSchemas(fileName, baselineSchema, candidateSchema, "$", "root");
}

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

function loadSchemaDirectory(dirPath, label) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    addError(`Unable to read ${label} directory ${dirPath}: ${String(error)}`);
    return null;
  }

  const schemaFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".schema.json"))
    .map((entry) => entry.name)
    .sort();

  if (schemaFiles.length === 0) {
    addError(`${label} directory ${dirPath} does not contain any *.schema.json files.`);
    return null;
  }

  const schemas = new Map();
  for (const fileName of schemaFiles) {
    const fullPath = path.join(dirPath, fileName);
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      schemas.set(fileName, parsed);
    } catch (error) {
      addError(`Unable to parse ${label} schema ${fullPath}: ${String(error)}`);
      return null;
    }
  }

  return schemas;
}

function validateEventEnvelope(label, fileName, schema) {
  const eventType = fileName.replace(/\.schema\.json$/, "");

  if (!isObject(schema)) {
    addError(`${label} schema ${fileName} must be a JSON object.`);
    return;
  }

  if (schema.type !== "object") {
    addError(`${label} schema ${fileName} must use top-level type=object.`);
  }

  if (!isObject(schema.properties)) {
    addError(`${label} schema ${fileName} must define top-level properties.`);
    return;
  }

  const required = new Set(toArray(schema.required));
  const mandatoryEnvelopeFields = [
    "eventId",
    "eventType",
    "eventVersion",
    "occurredAt",
    "producer",
    "idempotencyKey",
    "correlationId",
    "payload"
  ];

  for (const field of mandatoryEnvelopeFields) {
    if (!required.has(field)) {
      addError(`${label} schema ${fileName} must require envelope field '${field}'.`);
    }

    if (!(field in schema.properties)) {
      addError(`${label} schema ${fileName} must define envelope field '${field}'.`);
    }
  }

  const eventTypeSchema = schema.properties.eventType;
  if (!isObject(eventTypeSchema) || eventTypeSchema.const !== eventType) {
    addError(
      `${label} schema ${fileName} must set properties.eventType.const to '${eventType}'.`
    );
  }

  const eventVersionSchema = schema.properties.eventVersion;
  if (!isObject(eventVersionSchema) || eventVersionSchema.const !== 1) {
    addError(`${label} schema ${fileName} must set properties.eventVersion.const to 1.`);
  }

  const payloadSchema = schema.properties.payload;
  if (!isObject(payloadSchema) || resolveType(payloadSchema) !== "object") {
    addError(`${label} schema ${fileName} must define payload as object schema.`);
  }
}

function compareSchemas(fileName, baselineSchema, candidateSchema, location, contextType) {
  const baselineType = resolveType(baselineSchema);
  const candidateType = resolveType(candidateSchema);

  if (baselineType && candidateType && baselineType !== candidateType) {
    addError(
      `Candidate schema ${fileName} changed type at ${location} (${baselineType} -> ${candidateType}).`
    );
    return;
  }

  if (baselineSchema && Object.prototype.hasOwnProperty.call(baselineSchema, "const")) {
    if (!Object.prototype.hasOwnProperty.call(candidateSchema, "const")) {
      addError(`Candidate schema ${fileName} removed const at ${location}.`);
    } else if (!deepEqual(baselineSchema.const, candidateSchema.const)) {
      addError(`Candidate schema ${fileName} changed const at ${location}.`);
    }
  }

  if (Array.isArray(baselineSchema.enum)) {
    if (!Array.isArray(candidateSchema.enum)) {
      addError(`Candidate schema ${fileName} removed enum at ${location}.`);
    } else {
      for (const baselineValue of baselineSchema.enum) {
        if (!candidateSchema.enum.some((candidateValue) => deepEqual(candidateValue, baselineValue))) {
          addError(
            `Candidate schema ${fileName} removed enum value '${String(baselineValue)}' at ${location}.`
          );
        }
      }
    }
  }

  if (baselineType === "object") {
    compareObjectSchemas(fileName, baselineSchema, candidateSchema, location, contextType);
    return;
  }

  if (baselineType === "array") {
    if (!candidateSchema.items) {
      addError(`Candidate schema ${fileName} removed array items at ${location}.`);
      return;
    }

    compareSchemas(fileName, baselineSchema.items, candidateSchema.items, `${location}[]`, contextType);
  }
}

function compareObjectSchemas(fileName, baselineSchema, candidateSchema, location, contextType) {
  const baselineProperties = isObject(baselineSchema.properties) ? baselineSchema.properties : {};
  const candidateProperties = isObject(candidateSchema.properties) ? candidateSchema.properties : {};

  for (const [propertyName, baselinePropertySchema] of Object.entries(baselineProperties)) {
    if (!(propertyName in candidateProperties)) {
      addError(`Candidate schema ${fileName} removed property '${propertyName}' at ${location}.`);
      continue;
    }

    compareSchemas(
      fileName,
      baselinePropertySchema,
      candidateProperties[propertyName],
      `${location}.${propertyName}`,
      contextType
    );
  }

  const baselineRequired = new Set(toArray(baselineSchema.required));
  const candidateRequired = new Set(toArray(candidateSchema.required));

  for (const requiredField of baselineRequired) {
    if (!candidateRequired.has(requiredField)) {
      addError(
        `Candidate schema ${fileName} removed required field '${requiredField}' at ${location}.`
      );
    }
  }

  for (const requiredField of candidateRequired) {
    if (!baselineRequired.has(requiredField)) {
      addError(
        `Candidate schema ${fileName} added required field '${requiredField}' at ${location}.`
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(baselineSchema, "additionalProperties") &&
    baselineSchema.additionalProperties === false &&
    candidateSchema.additionalProperties !== false
  ) {
    addError(`Candidate schema ${fileName} relaxed additionalProperties at ${location}.`);
  }
}

function resolveType(schema) {
  if (!isObject(schema)) {
    return null;
  }

  if (typeof schema.type === "string") {
    return schema.type;
  }

  if (isObject(schema.properties)) {
    return "object";
  }

  if (schema.items) {
    return "array";
  }

  return null;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
