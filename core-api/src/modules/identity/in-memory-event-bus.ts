import type { DomainEvent } from "./types.js";

export type DomainEventSubscriber = (event: DomainEvent) => void | Promise<void>;

export class InMemoryEventBus {
  public readonly events: DomainEvent[] = [];
  private readonly subscribers = new Set<DomainEventSubscriber>();
  private readonly pendingSubscriberTasks = new Set<Promise<void>>();

  publish(event: DomainEvent): void {
    this.events.push(event);

    for (const subscriber of this.subscribers) {
      try {
        const candidateTask = subscriber(event);
        if (!candidateTask || typeof (candidateTask as Promise<void>).then !== "function") {
          continue;
        }

        const task = Promise.resolve(candidateTask).catch(() => {});
        this.pendingSubscriberTasks.add(task);
        void task.finally(() => {
          this.pendingSubscriberTasks.delete(task);
        });
      } catch {
        // Subscribers are best-effort side effects and must not block domain transitions.
      }
    }
  }

  subscribe(subscriber: DomainEventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  async flush(): Promise<void> {
    await Promise.all([...this.pendingSubscriberTasks]);
  }
}
