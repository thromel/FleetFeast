import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryStructuredLogRepository } from "./in-memory-structured-log-repository.js";
import type {
  FinishTraceInput,
  StartTraceInput,
  StructuredLogEntry,
  TraceContext,
} from "./types.js";

export class ObservabilityService {
  constructor(
    private readonly repository: InMemoryStructuredLogRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  startTrace(input: StartTraceInput): TraceContext {
    return {
      traceId: randomUUID(),
      spanId: randomUUID(),
      method: input.method,
      route: input.route,
      startedAt: new Date().toISOString(),
      startedAtMs: Date.now(),
    };
  }

  finishTrace(context: TraceContext, input: FinishTraceInput): StructuredLogEntry {
    const timestamp = new Date().toISOString();
    const durationMs = Date.now() - context.startedAtMs;
    const log: StructuredLogEntry = {
      timestamp,
      level: input.statusCode >= 500 ? "ERROR" : "INFO",
      service: "core-api",
      traceId: context.traceId,
      spanId: context.spanId,
      method: context.method,
      route: context.route,
      statusCode: input.statusCode,
      durationMs,
      message: "HTTP request completed",
      metadata: input.metadata ?? {},
    };

    this.repository.append(log);
    this.eventBus.publish({
      type: "platform.trace_emitted.v1",
      occurredAt: timestamp,
      payload: {
        traceId: log.traceId,
        spanId: log.spanId,
        method: log.method,
        route: log.route,
        statusCode: log.statusCode,
      },
    });

    return log;
  }

  listLogs(traceId?: string): StructuredLogEntry[] {
    return this.repository.list(traceId);
  }
}
