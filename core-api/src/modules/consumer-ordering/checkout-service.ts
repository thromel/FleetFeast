import { randomUUID } from "node:crypto";

import { InMemoryCheckoutRepository } from "./in-memory-checkout-repository.js";
import { InMemoryQuoteRepository } from "../pricing-promotions/in-memory-quote-repository.js";

export interface CheckoutInput {
  basketId: string;
  quoteId: string;
  quoteHash: string;
}

export interface CheckoutPayload {
  checkoutId: string;
  basketId: string;
  quoteId: string;
  quoteHash: string;
  totalCents: number;
  currency: string;
  expiresAt: string;
}

export class StaleQuoteError extends Error {
  code = "ORDERING_STALE_QUOTE";

  constructor(message: string) {
    super(message);
    this.name = "StaleQuoteError";
  }
}

export class CheckoutService {
  constructor(
    private readonly quoteRepository: InMemoryQuoteRepository,
    private readonly checkoutRepository = new InMemoryCheckoutRepository(),
  ) {}

  async createCheckout(input: CheckoutInput): Promise<CheckoutPayload> {
    const quote = await this.quoteRepository.findById(input.quoteId);
    if (!quote) {
      throw new StaleQuoteError("Quote snapshot not found.");
    }

    if (quote.basketId !== input.basketId || quote.quoteHash !== input.quoteHash) {
      throw new StaleQuoteError("Quote snapshot mismatch.");
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const payload: CheckoutPayload = {
      checkoutId: randomUUID(),
      basketId: input.basketId,
      quoteId: input.quoteId,
      quoteHash: input.quoteHash,
      totalCents: quote.totalCents,
      currency: quote.currency,
      expiresAt,
    };

    await this.checkoutRepository.save(payload);
    return payload;
  }
}
