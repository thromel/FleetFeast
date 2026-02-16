import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryPayoutStatementRepository } from "./in-memory-payout-statement-repository.js";
import {
  PayoutStatementService,
  type PayoutStatementRenderer,
} from "./payout-statement-service.js";

test("publishes payout statement with rendered PDF content and emits event", async () => {
  const eventBus = new InMemoryEventBus();
  const renderer: PayoutStatementRenderer = {
    render: async () => "s3://statements/payout-statement-1.pdf",
  };

  const service = new PayoutStatementService(
    new InMemoryPayoutStatementRepository(),
    eventBus,
    renderer,
  );

  const statement = await service.publishStatement({
    payoutBatchId: "batch-1",
    entityType: "MERCHANT",
    entityId: "merchant-1",
    periodStart: "2026-02-01T00:00:00Z",
    periodEnd: "2026-02-07T23:59:59Z",
    currency: "USD",
    totalAmount: 1200,
    lineItems: [
      {
        label: "Order Earnings",
        amount: 1400,
      },
      {
        label: "Platform Fee",
        amount: -200,
      },
    ],
  });

  assert.equal(statement.format, "PDF");
  assert.equal(statement.renderedContent, "s3://statements/payout-statement-1.pdf");
  const event = eventBus.events.find((candidate) => candidate.type === "payout.statement_published.v1");
  assert.ok(event);
});

test("falls back to plain-text statement after render retries are exhausted", async () => {
  const eventBus = new InMemoryEventBus();
  let attempts = 0;

  const failingRenderer: PayoutStatementRenderer = {
    render: async () => {
      attempts += 1;
      throw new Error("renderer unavailable");
    },
  };

  const service = new PayoutStatementService(
    new InMemoryPayoutStatementRepository(),
    eventBus,
    failingRenderer,
    2,
  );

  const statement = await service.publishStatement({
    payoutBatchId: "batch-2",
    entityType: "COURIER",
    entityId: "courier-1",
    periodStart: "2026-02-01T00:00:00Z",
    periodEnd: "2026-02-07T23:59:59Z",
    currency: "USD",
    totalAmount: 800,
    lineItems: [
      {
        label: "Delivery Earnings",
        amount: 800,
      },
    ],
  });

  assert.equal(attempts, 2);
  assert.equal(statement.format, "PLAINTEXT");
  assert.match(statement.renderedContent, /batch-2/);
});
