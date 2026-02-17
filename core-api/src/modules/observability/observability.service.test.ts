import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryStructuredLogRepository } from "./in-memory-structured-log-repository.js";
import { ObservabilityService } from "./observability-service.js";

test("emits structured trace log with required schema fields", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new ObservabilityService(new InMemoryStructuredLogRepository(), eventBus);

  const trace = service.startTrace({
    method: "GET",
    route: "/health",
  });

  service.finishTrace(trace, {
    statusCode: 200,
    metadata: { handler: "health" },
  });

  const logs = service.listLogs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.traceId, trace.traceId);
  assert.equal(logs[0]?.method, "GET");
  assert.equal(logs[0]?.route, "/health");
  assert.equal(logs[0]?.statusCode, 200);

  const traceEvent = eventBus.events.find((event) => event.type === "platform.trace_emitted.v1");
  assert.ok(traceEvent);
});
