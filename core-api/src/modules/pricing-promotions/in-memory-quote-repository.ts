import type { Quote } from "./types.js";

export class InMemoryQuoteRepository {
  private readonly quotes = new Map<string, Quote>();

  async save(quote: Quote): Promise<void> {
    this.quotes.set(quote.quoteId, quote);
  }

  async findById(quoteId: string): Promise<Quote | null> {
    return this.quotes.get(quoteId) ?? null;
  }
}
