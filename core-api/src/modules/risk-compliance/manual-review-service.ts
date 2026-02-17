import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryManualReviewRepository } from "./in-memory-manual-review-repository.js";
import type {
  ManualReviewRecord,
  QueueManualReviewInput,
  ResolveManualReviewInput,
} from "./types.js";

export class ManualReviewNotFoundError extends Error {
  code = "RISK_MANUAL_REVIEW_NOT_FOUND";

  constructor(reviewId: string) {
    super(`Manual review '${reviewId}' was not found.`);
    this.name = "ManualReviewNotFoundError";
  }
}

export class ManualReviewService {
  constructor(
    private readonly repository: InMemoryManualReviewRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async queueReview(input: QueueManualReviewInput): Promise<ManualReviewRecord> {
    const createdAt = new Date().toISOString();
    const review: ManualReviewRecord = {
      reviewId: randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      orderId: input.orderId,
      amountCents: input.amountCents,
      reasonCode: input.reasonCode,
      requestedBy: input.requestedBy,
      status: "QUEUED",
      createdAt,
      updatedAt: createdAt,
    };

    await this.repository.save(review);
    this.eventBus.publish({
      type: "risk.manual_review_queued.v1",
      occurredAt: createdAt,
      payload: {
        reviewId: review.reviewId,
        entityType: review.entityType,
        entityId: review.entityId,
        reasonCode: review.reasonCode,
      },
    });

    return review;
  }

  async resolveReview(input: ResolveManualReviewInput): Promise<ManualReviewRecord> {
    const review = await this.repository.findById(input.reviewId);
    if (!review) {
      throw new ManualReviewNotFoundError(input.reviewId);
    }

    if (review.status !== "QUEUED") {
      return review;
    }

    const resolvedAt = new Date().toISOString();
    const updated: ManualReviewRecord = {
      ...review,
      status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
      updatedAt: resolvedAt,
      resolution: {
        decision: input.decision,
        resolvedBy: input.resolvedBy,
        resolvedAt,
        note: input.note,
      },
    };

    await this.repository.save(updated);
    this.eventBus.publish({
      type: "risk.manual_review_resolved.v1",
      occurredAt: resolvedAt,
      payload: {
        reviewId: updated.reviewId,
        entityType: updated.entityType,
        entityId: updated.entityId,
        decision: updated.resolution?.decision,
        resolvedBy: updated.resolution?.resolvedBy,
      },
    });

    return updated;
  }
}
