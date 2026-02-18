import { InMemoryManualReviewRepository } from "../../../modules/risk-compliance/in-memory-manual-review-repository.js";
import type { ManualReviewRecord } from "../../../modules/risk-compliance/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "risk.manual_reviews";

export class PersistentManualReviewRepository extends InMemoryManualReviewRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(review: ManualReviewRecord): Promise<void> {
    await this.store.put(NAMESPACE, review.reviewId, {
      ...review,
      resolution: review.resolution ? { ...review.resolution } : undefined,
    });
  }

  override async findById(reviewId: string): Promise<ManualReviewRecord | null> {
    const review = await this.store.get<ManualReviewRecord>(NAMESPACE, reviewId);
    if (!review) {
      return null;
    }

    return {
      ...review,
      resolution: review.resolution ? { ...review.resolution } : undefined,
    };
  }
}
