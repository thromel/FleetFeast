export interface PromotionEvaluationInput {
  consumerId?: string;
  merchantId?: string;
  subtotalCents: number;
  promoCode?: string;
  deliveryFeeCents?: number;
}

export interface PromotionEvaluationResult {
  eligible: boolean;
  reason: "NO_PROMO" | "PROMO_NOT_FOUND" | "MINIMUM_NOT_MET" | "ELIGIBLE";
  discountCents: number;
  promoCode: string | null;
}

export interface GenerateQuoteInput {
  basketId: string;
  promoCode?: string;
}

export interface Quote {
  quoteId: string;
  quoteHash: string;
  basketId: string;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  serviceFeeCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  promo: PromotionEvaluationResult | null;
  generatedAt: string;
}
