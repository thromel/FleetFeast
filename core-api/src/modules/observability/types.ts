export interface TraceContext {
  traceId: string;
  spanId: string;
  method: string;
  route: string;
  startedAt: string;
  startedAtMs: number;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: "INFO" | "ERROR";
  service: string;
  traceId: string;
  spanId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  message: string;
  metadata: Record<string, unknown>;
}

export interface StartTraceInput {
  method: string;
  route: string;
}

export interface FinishTraceInput {
  statusCode: number;
  metadata?: Record<string, unknown>;
}
