import type { ManualReviewRecord } from "./types.js";

export class InMemoryManualReviewRepository {
  private readonly reviews = new Map<string, ManualReviewRecord>();

  async save(review: ManualReviewRecord): Promise<void> {
    this.reviews.set(review.reviewId, review);
  }

  async findById(reviewId: string): Promise<ManualReviewRecord | null> {
    return this.reviews.get(reviewId) ?? null;
  }
}
