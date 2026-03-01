import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../../modules/identity/in-memory-event-bus.js";
import type { DomainEvent } from "../../modules/identity/types.js";
import type { EventBroker } from "../broker/event-broker.js";
import type { DocumentStore } from "../persistence/document-store.js";
import type { RealtimeEventForwarder } from "../realtime/realtime-event-forwarder.js";

export class DurableEventBus extends InMemoryEventBus {
  private readonly hydrationTask: Promise<void>;
  private readonly pendingPublishes = new Set<Promise<void>>();

  constructor(
    private readonly documentStore?: DocumentStore,
    private readonly broker?: EventBroker,
    private readonly outboxNamespace: string = "platform.event_outbox",
    private readonly realtimeForwarder?: RealtimeEventForwarder,
  ) {
    super();
    this.hydrationTask = this.hydrateFromOutbox();
  }

  override publish(event: DomainEvent): void {
    const publishTask = this.hydrationTask.then(async () => {
      super.publish(event);
      await this.persistAndPublish(event);
    });
    this.pendingPublishes.add(publishTask);
    void publishTask.finally(() => {
      this.pendingPublishes.delete(publishTask);
    });
  }

  async flush(): Promise<void> {
    await this.hydrationTask;
    await Promise.all([...this.pendingPublishes]);
  }

  private async hydrateFromOutbox(): Promise<void> {
    if (!this.documentStore) {
      return;
    }

    const persistedEvents = await this.documentStore.list<DomainEvent>(this.outboxNamespace);
    for (const event of persistedEvents) {
      super.publish(event);
    }
  }

  private async persistAndPublish(event: DomainEvent): Promise<void> {
    if (this.documentStore) {
      await this.documentStore.put(this.outboxNamespace, randomUUID(), event);
    }

    if (this.broker) {
      await this.broker.publish(event.type, JSON.stringify(event));
    }

    if (this.realtimeForwarder) {
      await this.realtimeForwarder.forward(event);
    }
  }
}
