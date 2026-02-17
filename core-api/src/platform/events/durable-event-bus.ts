import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../../modules/identity/in-memory-event-bus.js";
import type { DomainEvent } from "../../modules/identity/types.js";
import type { EventBroker } from "../broker/event-broker.js";
import type { DocumentStore } from "../persistence/document-store.js";

export class DurableEventBus extends InMemoryEventBus {
  private readonly pendingPublishes = new Set<Promise<void>>();

  constructor(
    private readonly documentStore?: DocumentStore,
    private readonly broker?: EventBroker,
    private readonly outboxNamespace: string = "platform.event_outbox",
  ) {
    super();
  }

  override publish(event: DomainEvent): void {
    super.publish(event);

    const publishTask = this.persistAndPublish(event);
    this.pendingPublishes.add(publishTask);
    void publishTask.finally(() => {
      this.pendingPublishes.delete(publishTask);
    });
  }

  async flush(): Promise<void> {
    await Promise.all([...this.pendingPublishes]);
  }

  private async persistAndPublish(event: DomainEvent): Promise<void> {
    if (this.documentStore) {
      await this.documentStore.put(this.outboxNamespace, randomUUID(), event);
    }

    if (this.broker) {
      await this.broker.publish(event.type, JSON.stringify(event));
    }
  }
}
