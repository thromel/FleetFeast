import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import type { SLOBreach, SLOReport, StructuredLogEntry } from "./types.js";

export class SLOService {
  constructor(private readonly eventBus: InMemoryEventBus) {}

  async evaluate(logs: StructuredLogEntry[]): Promise<SLOReport> {
    const availabilityLogs = logs.filter(
      (log) =>
        log.route.startsWith("/api/v1/consumer/checkout") ||
        log.route.startsWith("/api/v1/consumer/orders"),
    );
    const successfulRequests = availabilityLogs.filter((log) => log.statusCode < 500).length;
    const availabilityPercent =
      availabilityLogs.length === 0
        ? 100
        : Number(((successfulRequests / availabilityLogs.length) * 100).toFixed(3));

    const checkoutP95Ms = this.percentile95(
      logs
        .filter((log) => log.route.startsWith("/api/v1/consumer/checkout"))
        .map((log) => log.durationMs),
    );
    const timelineP95Ms = this.percentile95(
      logs
        .filter((log) => log.route.includes("/timeline"))
        .map((log) => log.durationMs),
    );

    const breaches: SLOBreach[] = [];

    if (availabilityPercent < 99.9) {
      breaches.push({
        type: "AVAILABILITY",
        actual: availabilityPercent,
        threshold: 99.9,
      });
      this.eventBus.publish({
        type: "platform.slo_breach_detected.v1",
        occurredAt: new Date().toISOString(),
        payload: {
          metric: "availabilityPercent",
          actual: availabilityPercent,
          threshold: 99.9,
        },
      });
    }

    if (checkoutP95Ms > 700) {
      breaches.push({
        type: "LATENCY_CHECKOUT",
        actual: checkoutP95Ms,
        threshold: 700,
      });
      this.eventBus.publish({
        type: "platform.latency_budget_breached.v1",
        occurredAt: new Date().toISOString(),
        payload: {
          metric: "checkoutP95Ms",
          actual: checkoutP95Ms,
          threshold: 700,
        },
      });
    }

    if (timelineP95Ms > 400) {
      breaches.push({
        type: "LATENCY_TIMELINE",
        actual: timelineP95Ms,
        threshold: 400,
      });
      this.eventBus.publish({
        type: "platform.latency_budget_breached.v1",
        occurredAt: new Date().toISOString(),
        payload: {
          metric: "timelineP95Ms",
          actual: timelineP95Ms,
          threshold: 400,
        },
      });
    }

    return {
      availabilityPercent,
      checkoutP95Ms,
      timelineP95Ms,
      breaches,
    };
  }

  private percentile95(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(index, 0)] ?? 0;
  }
}
