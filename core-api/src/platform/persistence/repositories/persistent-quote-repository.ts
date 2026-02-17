import { InMemoryQuoteRepository } from "../../../modules/pricing-promotions/in-memory-quote-repository.js";
import type { Quote } from "../../../modules/pricing-promotions/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "pricing.quotes";

export class PersistentQuoteRepository extends InMemoryQuoteRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(quote: Quote): Promise<void> {
    await this.store.put(NAMESPACE, quote.quoteId, quote);
  }

  override async findById(quoteId: string): Promise<Quote | null> {
    return this.store.get<Quote>(NAMESPACE, quoteId);
  }
}
