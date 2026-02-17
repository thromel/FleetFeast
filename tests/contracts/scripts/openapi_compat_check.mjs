#!/usr/bin/env node

import fs from "node:fs";

const OPERATION_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace"
];

const [baselinePath, candidatePath] = process.argv.slice(2);

if (!baselinePath || !candidatePath) {
  console.error(
    "Usage: node tests/contracts/scripts/openapi_compat_check.mjs <baseline-spec.json> <candidate-spec.json>"
  );
  process.exit(2);
}

const errors = [];

const baselineSpec = loadJsonFile(baselinePath, "baseline");
const candidateSpec = loadJsonFile(candidatePath, "candidate");

if (!baselineSpec || !candidateSpec) {
  process.exit(1);
}

validateOpenApiShape("baseline", baselineSpec);
validateOpenApiShape("candidate", candidateSpec);
validateNamespaceCoverage("baseline", baselineSpec);
validateNamespaceCoverage("candidate", candidateSpec);
validateErrorSchema("baseline", baselineSpec);
validateErrorSchema("candidate", candidateSpec);
checkBackwardCompatibility(baselineSpec, candidateSpec);

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

function loadJsonFile(path, label) {
  try {
    const fileContents = fs.readFileSync(path, "utf-8");
    return JSON.parse(fileContents);
  } catch (error) {
    addError(`Failed to parse ${label} OpenAPI file at ${path}: ${String(error)}`);
    return null;
  }
}

function validateOpenApiShape(label, spec) {
  if (!isObject(spec)) {
    addError(`${label} spec must be a JSON object.`);
    return;
  }

  if (typeof spec.openapi !== "string" || !spec.openapi.startsWith("3.")) {
    addError(`${label} spec must declare an OpenAPI 3.x version.`);
  }

  if (!isObject(spec.info) || typeof spec.info.title !== "string" || typeof spec.info.version !== "string") {
    addError(`${label} spec must declare info.title and info.version.`);
  }

  if (!isObject(spec.paths) || Object.keys(spec.paths).length === 0) {
    addError(`${label} spec must declare at least one path.`);
    return;
  }

  for (const [pathName, pathItem] of Object.entries(spec.paths)) {
    if (!isObject(pathItem)) {
      addError(`${label} path ${pathName} must be an object.`);
      continue;
    }

    const operationNames = OPERATION_METHODS.filter((method) => isObject(pathItem[method]));
    if (operationNames.length === 0) {
      addError(`${label} path ${pathName} must include at least one HTTP operation.`);
      continue;
    }

    for (const method of operationNames) {
      const operation = pathItem[method];
      if (!isObject(operation.responses) || Object.keys(operation.responses).length === 0) {
        addError(`${label} ${method.toUpperCase()} ${pathName} must define responses.`);
      }
    }
  }
}

function validateNamespaceCoverage(label, spec) {
  if (!isObject(spec.paths)) {
    return;
  }

  const requiredPrefixes = [
    "/api/v1/consumer/",
    "/api/v1/merchant/",
    "/api/v1/courier/",
    "/api/v1/admin/"
  ];

  const pathNames = Object.keys(spec.paths);
  for (const prefix of requiredPrefixes) {
    if (!pathNames.some((pathName) => pathName.startsWith(prefix))) {
      addError(`${label} spec must include at least one path under ${prefix}`);
    }
  }
}

function validateErrorSchema(label, spec) {
  const errorSchema = resolveSchema(spec, { $ref: "#/components/schemas/ErrorResponse" });
  if (!isObject(errorSchema)) {
    addError(`${label} spec must define components.schemas.ErrorResponse.`);
    return;
  }

  const requiredFields = new Set(toArray(errorSchema.required));
  for (const field of ["code", "message", "traceId"]) {
    if (!requiredFields.has(field)) {
      addError(`${label} ErrorResponse must require field '${field}'.`);
    }
  }

  if (errorSchema.type && errorSchema.type !== "object") {
    addError(`${label} ErrorResponse must be type object.`);
  }

  if (!isObject(spec.paths)) {
    return;
  }

  for (const [pathName, pathItem] of Object.entries(spec.paths)) {
    for (const method of OPERATION_METHODS) {
      const operation = pathItem?.[method];
      if (!isObject(operation)) {
        continue;
      }

      const responses = isObject(operation.responses) ? operation.responses : {};
      for (const [statusCode, response] of Object.entries(responses)) {
        if (!/^4\d\d$/.test(statusCode) && !/^5\d\d$/.test(statusCode)) {
          continue;
        }

        const responseSchema = resolveSchema(spec, getResponseJsonSchema(response));
        if (!isObject(responseSchema)) {
          addError(
            `${label} ${method.toUpperCase()} ${pathName} ${statusCode} response must define an application/json schema.`
          );
          continue;
        }

        const required = new Set(toArray(responseSchema.required));
        for (const field of ["code", "message", "traceId"]) {
          if (!required.has(field)) {
            addError(
              `${label} ${method.toUpperCase()} ${pathName} ${statusCode} response must require '${field}'.`
            );
          }
        }
      }
    }
  }
}

function checkBackwardCompatibility(baseline, candidate) {
  if (!isObject(baseline.paths) || !isObject(candidate.paths)) {
    return;
  }

  for (const [pathName, baselinePathItem] of Object.entries(baseline.paths)) {
    const candidatePathItem = candidate.paths[pathName];
    if (!isObject(candidatePathItem)) {
      addError(`Candidate spec removed path ${pathName}.`);
      continue;
    }

    for (const method of OPERATION_METHODS) {
      const baselineOperation = baselinePathItem[method];
      if (!isObject(baselineOperation)) {
        continue;
      }

      const candidateOperation = candidatePathItem[method];
      if (!isObject(candidateOperation)) {
        addError(`Candidate spec removed ${method.toUpperCase()} ${pathName}.`);
        continue;
      }

      compareResponses(pathName, method, baseline, candidate, baselineOperation, candidateOperation);
      compareParameters(pathName, method, baseline, candidate, baselinePathItem, candidatePathItem, baselineOperation, candidateOperation);
      compareRequestBody(pathName, method, baseline, candidate, baselineOperation, candidateOperation);
    }
  }
}

function compareResponses(pathName, method, baselineSpec, candidateSpec, baselineOperation, candidateOperation) {
  const baselineResponses = isObject(baselineOperation.responses) ? baselineOperation.responses : {};
  const candidateResponses = isObject(candidateOperation.responses) ? candidateOperation.responses : {};

  for (const baselineStatus of Object.keys(baselineResponses)) {
    if (!(baselineStatus in candidateResponses)) {
      addError(
        `Candidate spec removed status ${baselineStatus} from ${method.toUpperCase()} ${pathName}.`
      );
      continue;
    }

    const baselineSchema = resolveSchema(
      baselineSpec,
      getResponseJsonSchema(baselineResponses[baselineStatus])
    );
    const candidateSchema = resolveSchema(
      candidateSpec,
      getResponseJsonSchema(candidateResponses[baselineStatus])
    );

    compareSchemaProperties(
      `${method.toUpperCase()} ${pathName} response ${baselineStatus}`,
      baselineSpec,
      candidateSpec,
      baselineSchema,
      candidateSchema,
      "response"
    );
  }
}

function compareParameters(
  pathName,
  method,
  baselineSpec,
  candidateSpec,
  baselinePathItem,
  candidatePathItem,
  baselineOperation,
  candidateOperation
) {
  const baselineParameters = normalizeParameters(
    baselinePathItem.parameters,
    baselineOperation.parameters,
    baselineSpec
  );
  const candidateParameters = normalizeParameters(
    candidatePathItem.parameters,
    candidateOperation.parameters,
    candidateSpec
  );

  for (const [parameterKey, baselineParameter] of baselineParameters.entries()) {
    if (baselineParameter.required !== true) {
      continue;
    }

    const candidateParameter = candidateParameters.get(parameterKey);
    if (!candidateParameter) {
      addError(`Candidate spec removed required parameter ${parameterKey} on ${method.toUpperCase()} ${pathName}.`);
      continue;
    }

    const baselineType = getSchemaType(baselineParameter.schema);
    const candidateType = getSchemaType(candidateParameter.schema);
    if (baselineType && candidateType && baselineType !== candidateType) {
      addError(
        `Candidate spec changed type of required parameter ${parameterKey} on ${method.toUpperCase()} ${pathName} (${baselineType} -> ${candidateType}).`
      );
    }
  }

  for (const [parameterKey, candidateParameter] of candidateParameters.entries()) {
    if (candidateParameter.required !== true) {
      continue;
    }

    if (!baselineParameters.has(parameterKey)) {
      addError(
        `Candidate spec added required parameter ${parameterKey} on ${method.toUpperCase()} ${pathName}.`
      );
    }
  }
}

function compareRequestBody(pathName, method, baselineSpec, candidateSpec, baselineOperation, candidateOperation) {
  const baselineSchema = resolveSchema(baselineSpec, getRequestJsonSchema(baselineOperation));
  const candidateSchema = resolveSchema(candidateSpec, getRequestJsonSchema(candidateOperation));

  if (baselineSchema && !candidateSchema) {
    addError(`Candidate spec removed request schema for ${method.toUpperCase()} ${pathName}.`);
    return;
  }

  compareSchemaProperties(
    `${method.toUpperCase()} ${pathName} request body`,
    baselineSpec,
    candidateSpec,
    baselineSchema,
    candidateSchema,
    "request"
  );
}

function compareSchemaProperties(context, baselineSpec, candidateSpec, baselineSchema, candidateSchema, mode) {
  if (!baselineSchema || !candidateSchema) {
    return;
  }

  const resolvedBaseline = resolveSchema(baselineSpec, baselineSchema);
  const resolvedCandidate = resolveSchema(candidateSpec, candidateSchema);

  if (!isObject(resolvedBaseline) || !isObject(resolvedCandidate)) {
    return;
  }

  const baselineType = getSchemaType(resolvedBaseline);
  const candidateType = getSchemaType(resolvedCandidate);
  if (baselineType && candidateType && baselineType !== candidateType) {
    addError(`Candidate spec changed schema type for ${context} (${baselineType} -> ${candidateType}).`);
    return;
  }

  if (baselineType !== "object" || candidateType !== "object") {
    return;
  }

  const baselineProperties = isObject(resolvedBaseline.properties) ? resolvedBaseline.properties : {};
  const candidateProperties = isObject(resolvedCandidate.properties) ? resolvedCandidate.properties : {};

  for (const [propertyName, baselineProperty] of Object.entries(baselineProperties)) {
    if (!(propertyName in candidateProperties)) {
      addError(`Candidate spec removed property '${propertyName}' from ${context}.`);
      continue;
    }

    const candidateProperty = candidateProperties[propertyName];
    const baselinePropertySchema = resolveSchema(baselineSpec, baselineProperty);
    const candidatePropertySchema = resolveSchema(candidateSpec, candidateProperty);
    const baselinePropertyType = getSchemaType(baselinePropertySchema);
    const candidatePropertyType = getSchemaType(candidatePropertySchema);

    if (baselinePropertyType && candidatePropertyType && baselinePropertyType !== candidatePropertyType) {
      addError(
        `Candidate spec changed type of property '${propertyName}' in ${context} (${baselinePropertyType} -> ${candidatePropertyType}).`
      );
    }
  }

  const baselineRequired = new Set(toArray(resolvedBaseline.required));
  const candidateRequired = new Set(toArray(resolvedCandidate.required));

  if (mode === "request") {
    for (const requiredField of candidateRequired) {
      if (!baselineRequired.has(requiredField)) {
        addError(`Candidate spec added required request field '${requiredField}' in ${context}.`);
      }
    }
  }

  if (mode === "response") {
    for (const requiredField of baselineRequired) {
      if (!candidateRequired.has(requiredField)) {
        addError(`Candidate spec removed required response field '${requiredField}' in ${context}.`);
      }
    }
  }
}

function normalizeParameters(pathParameters, operationParameters, spec) {
  const map = new Map();
  const allParameters = [...toArray(pathParameters), ...toArray(operationParameters)];

  for (const parameter of allParameters) {
    const resolved = resolveSchema(spec, parameter);
    if (!isObject(resolved) || typeof resolved.name !== "string" || typeof resolved.in !== "string") {
      continue;
    }

    map.set(`${resolved.in}:${resolved.name}`, {
      required: resolved.required === true,
      schema: resolveSchema(spec, resolved.schema)
    });
  }

  return map;
}

function getRequestJsonSchema(operation) {
  if (!isObject(operation) || !isObject(operation.requestBody)) {
    return null;
  }

  return getContentSchema(operation.requestBody.content);
}

function getResponseJsonSchema(response) {
  if (!isObject(response)) {
    return null;
  }

  return getContentSchema(response.content);
}

function getContentSchema(content) {
  if (!isObject(content)) {
    return null;
  }

  if (isObject(content["application/json"])) {
    return content["application/json"].schema ?? null;
  }

  for (const mediaType of Object.values(content)) {
    if (isObject(mediaType) && mediaType.schema) {
      return mediaType.schema;
    }
  }

  return null;
}

function resolveSchema(spec, schema, seenRefs = new Set()) {
  if (!isObject(schema)) {
    return schema ?? null;
  }

  if (typeof schema.$ref === "string") {
    const reference = schema.$ref;
    if (!reference.startsWith("#/")) {
      addError(`Only local refs are supported in compatibility checks. Found: ${reference}`);
      return null;
    }

    if (seenRefs.has(reference)) {
      addError(`Circular schema ref detected: ${reference}`);
      return null;
    }

    const resolved = resolveLocalRef(spec, reference);
    if (!resolved) {
      addError(`Unable to resolve schema ref ${reference}`);
      return null;
    }

    const nextSeen = new Set(seenRefs);
    nextSeen.add(reference);
    return resolveSchema(spec, resolved, nextSeen);
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return mergeAllOfSchemas(spec, schema.allOf);
  }

  return schema;
}

function resolveLocalRef(spec, ref) {
  const segments = ref.slice(2).split("/");
  let cursor = spec;
  for (const segment of segments) {
    if (!isObject(cursor) || !(segment in cursor)) {
      return null;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function mergeAllOfSchemas(spec, schemas) {
  const merged = { type: "object", properties: {}, required: [] };
  for (const schemaEntry of schemas) {
    const resolved = resolveSchema(spec, schemaEntry);
    if (!isObject(resolved)) {
      continue;
    }

    if (resolved.type && resolved.type !== "object") {
      return resolved;
    }

    if (isObject(resolved.properties)) {
      Object.assign(merged.properties, resolved.properties);
    }

    for (const requiredField of toArray(resolved.required)) {
      if (!merged.required.includes(requiredField)) {
        merged.required.push(requiredField);
      }
    }
  }

  return merged;
}

function getSchemaType(schema) {
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
