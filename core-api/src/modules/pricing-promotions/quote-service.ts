import { createHash, randomUUID } from "node:crypto";

import { InMemoryBasketRepository } from "../consumer-ordering/in-memory-basket-repository.js";
import { InMemoryQuoteRepository } from "./in-memory-quote-repository.js";
import type { Basket } from "../consumer-ordering/types.js";
import type {
  GenerateQuoteInput,
  PromotionEvaluationInput,
  PromotionEvaluationResult,
  Quote,
} from "./types.js";

const TAX_RATE = 0.08875;
const SERVICE_FEE_CENTS = 199;
const DELIVERY_FEE_CENTS = 299;

export class QuoteBasketNotFoundError extends Error {
  code = "ORDERING_BASKET_NOT_FOUND";

  constructor(basketId: string) {
    super(`Basket '${basketId}' was not found.`);
    this.name = "QuoteBasketNotFoundError";
  }
}

function subtotalFromBasket(basket: Basket): number {
  return basket.items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );
}

export class QuoteService {
  constructor(
    private readonly basketRepository: InMemoryBasketRepository,
    private readonly quoteRepository = new InMemoryQuoteRepository(),
  ) {}

  evaluatePromotion(input: PromotionEvaluationInput): PromotionEvaluationResult {
    if (!input.promoCode) {
      return {
        eligible: false,
        reason: "NO_PROMO",
        discountCents: 0,
        promoCode: null,
      };
    }

    const code = input.promoCode.toUpperCase();
    if (code === "WELCOME10") {
      if (input.subtotalCents < 1000) {
        return {
          eligible: false,
          reason: "MINIMUM_NOT_MET",
          discountCents: 0,
          promoCode: code,
        };
      }

      return {
        eligible: true,
        reason: "ELIGIBLE",
        discountCents: Math.min(Math.round(input.subtotalCents * 0.1), 1000),
        promoCode: code,
      };
    }

    if (code === "FREESHIP") {
      return {
        eligible: true,
        reason: "ELIGIBLE",
        discountCents: input.deliveryFeeCents ?? DELIVERY_FEE_CENTS,
        promoCode: code,
      };
    }

    return {
      eligible: false,
      reason: "PROMO_NOT_FOUND",
      discountCents: 0,
      promoCode: code,
    };
  }

  async generateQuote(input: GenerateQuoteInput): Promise<Quote> {
    const basket = await this.basketRepository.findById(input.basketId);
    if (!basket) {
      throw new QuoteBasketNotFoundError(input.basketId);
    }

    const subtotalCents = subtotalFromBasket(basket);
    const taxCents = Math.round(subtotalCents * TAX_RATE);

    const promo = this.evaluatePromotion({
      subtotalCents,
      promoCode: input.promoCode,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
    });

    const discountCents = promo.discountCents;
    const totalCents = Math.max(
      0,
      subtotalCents + taxCents + SERVICE_FEE_CENTS + DELIVERY_FEE_CENTS - discountCents,
    );

    const quoteHash = createHash("sha256")
      .update(
        JSON.stringify({
          basketId: basket.id,
          currency: basket.currency,
          subtotalCents,
          taxCents,
          serviceFeeCents: SERVICE_FEE_CENTS,
          deliveryFeeCents: DELIVERY_FEE_CENTS,
          discountCents,
          totalCents,
          promoCode: promo.promoCode,
        }),
      )
      .digest("hex");

    const quote: Quote = {
      quoteId: randomUUID(),
      quoteHash,
      basketId: basket.id,
      currency: basket.currency,
      subtotalCents,
      taxCents,
      serviceFeeCents: SERVICE_FEE_CENTS,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      discountCents,
      totalCents,
      promo,
      generatedAt: new Date().toISOString(),
    };

    await this.quoteRepository.save(quote);
    return quote;
  }
}
