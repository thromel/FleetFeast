import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { SLOService } from "./slo-service.js";

test("computes availability and latency metrics within budget", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new SLOService(eventBus);

  const report = await service.evaluate([
    {
      timestamp: "2026-02-16T10:00:00Z",
      level: "INFO",
      service: "core-api",
      traceId: "trace-1",
      spanId: "span-1",
      method: "POST",
      route: "/api/v1/consumer/checkout",
      statusCode: 200,
      durationMs: 320,
      message: "HTTP request completed",
      metadata: {},
    },
    {
      timestamp: "2026-02-16T10:00:01Z",
      level: "INFO",
      service: "core-api",
      traceId: "trace-2",
      spanId: "span-2",
      method: "GET",
      route: "/api/v1/consumer/orders/order-1/timeline",
      statusCode: 200,
      durationMs: 220,
      message: "HTTP request completed",
      metadata: {},
    },
  ]);

  assert.equal(report.availabilityPercent, 100);
  assert.equal(report.checkoutP95Ms, 320);
  assert.equal(report.timelineP95Ms, 220);
  assert.equal(report.breaches.length, 0);
});

test("emits alert events when availability or latency SLOs are breached", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new SLOService(eventBus);

  const report = await service.evaluate([
    {
      timestamp: "2026-02-16T10:00:00Z",
      level: "ERROR",
      service: "core-api",
      traceId: "trace-1",
      spanId: "span-1",
      method: "POST",
      route: "/api/v1/consumer/checkout",
      statusCode: 503,
      durationMs: 900,
      message: "HTTP request completed",
      metadata: {},
    },
    {
      timestamp: "2026-02-16T10:00:01Z",
      level: "INFO",
      service: "core-api",
      traceId: "trace-2",
      spanId: "span-2",
      method: "GET",
      route: "/api/v1/consumer/orders/order-1/timeline",
      statusCode: 200,
      durationMs: 700,
      message: "HTTP request completed",
      metadata: {},
    },
  ]);

  assert.ok(report.breaches.length >= 2);
  const availabilityBreach = eventBus.events.find(
    (event) => event.type === "platform.slo_breach_detected.v1",
  );
  const latencyBreach = eventBus.events.find(
    (event) => event.type === "platform.latency_budget_breached.v1",
  );
  assert.ok(availabilityBreach);
  assert.ok(latencyBreach);
});
