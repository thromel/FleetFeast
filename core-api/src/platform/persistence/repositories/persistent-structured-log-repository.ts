import { InMemoryStructuredLogRepository } from "../../../modules/observability/in-memory-structured-log-repository.js";
import type { StructuredLogEntry } from "../../../modules/observability/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "platform.structured_logs";

function cloneLog(log: StructuredLogEntry): StructuredLogEntry {
  return {
    ...log,
    metadata: { ...log.metadata },
  };
}

function logKey(log: StructuredLogEntry): string {
  return `${log.timestamp}:${log.traceId}:${log.spanId}`;
}

export class PersistentStructuredLogRepository extends InMemoryStructuredLogRepository {
  private readonly hydrationTask: Promise<void>;
  private readonly pendingWrites = new Set<Promise<void>>();

  constructor(private readonly store: DocumentStore) {
    super();
    this.hydrationTask = this.hydrate();
  }

  override append(log: StructuredLogEntry): void {
    super.append(cloneLog(log));

    const writeTask = this.hydrationTask.then(() =>
      this.store.put(NAMESPACE, logKey(log), cloneLog(log)),
    );
    this.pendingWrites.add(writeTask);
    void writeTask.finally(() => {
      this.pendingWrites.delete(writeTask);
    });
  }

  override async flush(): Promise<void> {
    await this.hydrationTask;
    await Promise.all([...this.pendingWrites]);
  }

  private async hydrate(): Promise<void> {
    const logs = await this.store.list<StructuredLogEntry>(NAMESPACE);
    const sortedLogs = [...logs].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp),
    );
    for (const log of sortedLogs) {
      super.append(cloneLog(log));
    }
  }
}
