import type { EventBroker } from "./event-broker.js";

export interface PublishedBrokerMessage {
  topic: string;
  payload: string;
  publishedAt: string;
}

export class InMemoryEventBroker implements EventBroker {
  public readonly messages: PublishedBrokerMessage[] = [];

  async publish(topic: string, payload: string): Promise<void> {
    this.messages.push({
      topic,
      payload,
      publishedAt: new Date().toISOString(),
    });
  }
}
