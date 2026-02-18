import type { StructuredLogEntry } from "./types.js";

export class InMemoryStructuredLogRepository {
  private readonly logs: StructuredLogEntry[] = [];

  append(log: StructuredLogEntry): void {
    this.logs.push({
      ...log,
      metadata: { ...log.metadata },
    });
  }

  list(traceId?: string): StructuredLogEntry[] {
    return this.logs
      .filter((log) => !traceId || log.traceId === traceId)
      .map((log) => ({
        ...log,
        metadata: { ...log.metadata },
      }));
  }

  async flush(): Promise<void> {
    // No-op for purely in-memory mode.
  }
}
