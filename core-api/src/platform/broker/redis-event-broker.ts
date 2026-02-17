import { createClient, type RedisClientType } from "redis";

import type { EventBroker } from "./event-broker.js";

export class RedisEventBroker implements EventBroker {
  private readonly client: RedisClientType;
  private connectionPromise: Promise<void> | null = null;

  constructor(
    redisUrl: string,
    private readonly streamName: string = "platform.events",
  ) {
    this.client = createClient({
      url: redisUrl,
    });
  }

  async publish(topic: string, payload: string): Promise<void> {
    await this.ensureConnected();
    await this.client.xAdd(this.streamName, "*", {
      topic,
      payload,
      published_at: new Date().toISOString(),
    });
  }

  async close(): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    await this.client.quit();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectionPromise) {
      this.connectionPromise = this.client.connect().then(() => undefined);
    }

    await this.connectionPromise;
  }
}
