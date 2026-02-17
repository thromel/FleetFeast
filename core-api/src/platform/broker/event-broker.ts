export interface EventBroker {
  publish(topic: string, payload: string): Promise<void>;
}
