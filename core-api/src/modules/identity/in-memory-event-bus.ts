import type { DomainEvent } from "./types.js";

export class InMemoryEventBus {
  public readonly events: DomainEvent[] = [];

  publish(event: DomainEvent): void {
    this.events.push(event);
  }
}
