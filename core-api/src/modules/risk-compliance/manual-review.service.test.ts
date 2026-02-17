import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryManualReviewRepository } from "./in-memory-manual-review-repository.js";
import {
  ManualReviewNotFoundError,
  ManualReviewService,
} from "./manual-review-service.js";

test("queues manual review for high-risk payout and emits queued event", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new ManualReviewService(new InMemoryManualReviewRepository(), eventBus);

  const review = await service.queueReview({
    entityType: "PAYOUT",
    entityId: "payout-batch-1",
    orderId: "order-1",
    amountCents: 12000,
    reasonCode: "HIGH_RISK_PAYOUT",
    requestedBy: "risk-engine",
  });

  assert.equal(review.status, "QUEUED");
  const queuedEvent = eventBus.events.find((event) => event.type === "risk.manual_review_queued.v1");
  assert.ok(queuedEvent);
});

test("resolves queued review and emits resolved event", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new ManualReviewService(new InMemoryManualReviewRepository(), eventBus);

  const review = await service.queueReview({
    entityType: "REFUND",
    entityId: "refund-1",
    orderId: "order-2",
    amountCents: 4500,
    reasonCode: "HIGH_RISK_REFUND",
    requestedBy: "risk-engine",
  });

  const resolved = await service.resolveReview({
    reviewId: review.reviewId,
    decision: "APPROVE",
    resolvedBy: "finance-ops-1",
    note: "verified",
  });

  assert.equal(resolved.status, "APPROVED");
  assert.equal(resolved.resolution?.resolvedBy, "finance-ops-1");
  const resolvedEvent = eventBus.events.find((event) => event.type === "risk.manual_review_resolved.v1");
  assert.ok(resolvedEvent);
});

test("throws when resolving unknown manual review", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new ManualReviewService(new InMemoryManualReviewRepository(), eventBus);

  await assert.rejects(
    () =>
      service.resolveReview({
        reviewId: "missing-review",
        decision: "REJECT",
        resolvedBy: "finance-ops-1",
      }),
    (error: unknown) => error instanceof ManualReviewNotFoundError,
  );
});
