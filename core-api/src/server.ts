import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { AuthError, AuthService } from "./modules/identity/auth-service.js";
import {
  BasketItemUnavailableError,
  BasketNotFoundError,
  BasketService,
} from "./modules/consumer-ordering/basket-service.js";
import { CheckoutService, StaleQuoteError } from "./modules/consumer-ordering/checkout-service.js";
import { InMemoryCheckoutRepository } from "./modules/consumer-ordering/in-memory-checkout-repository.js";
import { DeliveryZoneService } from "./modules/consumer-ordering/delivery-zone-service.js";
import { InMemoryDeliveryZoneRepository } from "./modules/consumer-ordering/in-memory-delivery-zone-repository.js";
import { InMemoryBasketRepository } from "./modules/consumer-ordering/in-memory-basket-repository.js";
import type {
  BasketItemInput,
  CreateBasketInput,
  UpdateBasketInput,
} from "./modules/consumer-ordering/types.js";
import type {
  UpsertDeliveryZoneInput,
  ValidateZonePointInput,
} from "./modules/consumer-ordering/delivery-zone-types.js";
import { InMemoryEventBus } from "./modules/identity/in-memory-event-bus.js";
import { InMemoryIdentityRepository } from "./modules/identity/in-memory-identity-repository.js";
import { InMemorySessionStore } from "./modules/identity/in-memory-session-store.js";
import { DuplicateIdentityError, IdentityService } from "./modules/identity/identity-service.js";
import { isAllowed } from "./modules/identity/rbac.js";
import type { RegisterIdentityInput, UserRole } from "./modules/identity/types.js";
import { InMemoryMenuRepository } from "./modules/merchant-catalog/in-memory-menu-repository.js";
import { InMemoryItemAvailabilityRepository } from "./modules/merchant-catalog/in-memory-item-availability-repository.js";
import { InMemoryStoreStatusRepository } from "./modules/merchant-catalog/in-memory-store-status-repository.js";
import { ItemAvailabilityService } from "./modules/merchant-catalog/item-availability-service.js";
import { MenuNotFoundError, MenuService } from "./modules/merchant-catalog/menu-service.js";
import { PrepTimeService } from "./modules/merchant-catalog/prep-time-service.js";
import { StoreStatusService } from "./modules/merchant-catalog/store-status-service.js";
import { InMemoryQuoteRepository } from "./modules/pricing-promotions/in-memory-quote-repository.js";
import { QuoteBasketNotFoundError, QuoteService } from "./modules/pricing-promotions/quote-service.js";
import { InMemoryNotificationQueueRepository } from "./modules/notifications/in-memory-notification-queue-repository.js";
import { NotificationFanoutService } from "./modules/notifications/notification-fanout-service.js";
import { InMemoryNotificationRetryRepository } from "./modules/notifications/in-memory-notification-retry-repository.js";
import { NotificationRetryService } from "./modules/notifications/notification-retry-service.js";
import {
  CancellationNotAllowedError,
  InvalidCheckoutError,
  OrderNotFoundError,
  OrderService,
  QuoteHashMismatchError,
} from "./modules/order-orchestration/order-service.js";
import { InMemoryOrderRepository } from "./modules/order-orchestration/in-memory-order-repository.js";
import { InMemoryOrderTimelineRepository } from "./modules/order-orchestration/in-memory-order-timeline-repository.js";
import { OrderTimelineService } from "./modules/order-orchestration/order-timeline-service.js";
import { InMemoryPaymentIntentRepository } from "./modules/payments/in-memory-payment-intent-repository.js";
import { InMemoryPaymentAuditRepository } from "./modules/payments/in-memory-payment-audit-repository.js";
import { InMemoryRefundRequestRepository } from "./modules/payments/in-memory-refund-request-repository.js";
import { InMemoryPSPAdapter } from "./modules/payments/in-memory-psp-adapter.js";
import {
  PaymentCashExpectationNotFoundError,
  PaymentCapturePreconditionError,
  PaymentIntentNotFoundError,
  PaymentMethodNotSupportedError,
  PaymentOrderNotFoundError,
  PaymentRefundAmountInvalidError,
  PaymentRefundRequestNotFoundError,
  PaymentService,
} from "./modules/payments/payment-service.js";
import { InMemorySettlementLedgerRepository } from "./modules/settlement/in-memory-settlement-ledger-repository.js";
import { InMemoryPayoutBatchRepository } from "./modules/settlement/in-memory-payout-batch-repository.js";
import { InMemoryPayoutStatementRepository } from "./modules/settlement/in-memory-payout-statement-repository.js";
import { PayoutService } from "./modules/settlement/payout-service.js";
import { PayoutStatementService } from "./modules/settlement/payout-statement-service.js";
import {
  SettlementLedgerService,
  UnbalancedJournalError,
} from "./modules/settlement/settlement-ledger-service.js";
import type {
  CreateMenuInput,
  MenuItemInput,
  UpdateMenuInput,
} from "./modules/merchant-catalog/types.js";
import type { UpdateStoreStatusInput } from "./modules/merchant-catalog/store-status-types.js";
import type { PaymentMethod } from "./modules/payments/types.js";
import type {
  GeneratePayoutBatchInput,
  LedgerSide,
  PostSettlementJournalInput,
  PayoutEntityType,
  PublishPayoutStatementInput,
} from "./modules/settlement/types.js";
import type {
  HandleNotificationFailureInput,
  QueueNotificationInput,
} from "./modules/notifications/types.js";

const supportedRoles: UserRole[] = [
  "consumer",
  "courier",
  "merchant_operator",
  "support_agent",
  "finance_ops",
  "system_admin",
];

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

async function parseJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf8").trim();
  if (body.length === 0) {
    return {};
  }

  return JSON.parse(body) as Record<string, unknown>;
}

function validateRegistrationPayload(payload: Record<string, unknown>): RegisterIdentityInput {
  const email = payload.email;
  const phone = payload.phone;
  const passwordHash = payload.passwordHash;
  const role = payload.role;

  if (
    typeof email !== "string" ||
    typeof phone !== "string" ||
    typeof passwordHash !== "string" ||
    typeof role !== "string" ||
    !supportedRoles.includes(role as UserRole)
  ) {
    throw new Error("INVALID_REGISTRATION_PAYLOAD");
  }

  return {
    email,
    phone,
    passwordHash,
    role: role as UserRole,
  };
}

function validateLoginPayload(payload: Record<string, unknown>): {
  email: string;
  passwordHash: string;
  mfaCode?: string;
} {
  const email = payload.email;
  const passwordHash = payload.passwordHash;
  const mfaCode = payload.mfaCode;

  if (
    typeof email !== "string" ||
    typeof passwordHash !== "string" ||
    (mfaCode !== undefined && typeof mfaCode !== "string")
  ) {
    throw new Error("INVALID_LOGIN_PAYLOAD");
  }

  return { email, passwordHash, mfaCode };
}

function validateRefreshPayload(payload: Record<string, unknown>): {
  refreshToken: string;
} {
  const refreshToken = payload.refreshToken;

  if (typeof refreshToken !== "string" || refreshToken.trim().length === 0) {
    throw new Error("INVALID_REFRESH_PAYLOAD");
  }

  return { refreshToken };
}

function validateMfaVerifyPayload(payload: Record<string, unknown>): {
  email: string;
  passwordHash: string;
  mfaCode: string;
} {
  const input = validateLoginPayload(payload);
  if (!input.mfaCode) {
    throw new Error("INVALID_MFA_VERIFY_PAYLOAD");
  }

  return {
    email: input.email,
    passwordHash: input.passwordHash,
    mfaCode: input.mfaCode,
  };
}

function validateMenuItems(items: unknown): MenuItemInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("INVALID_MENU_ITEMS");
  }

  const normalized = items.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("itemId" in item) ||
      !("name" in item) ||
      !("priceCents" in item)
    ) {
      throw new Error("INVALID_MENU_ITEMS");
    }

    const candidate = item as {
      itemId: unknown;
      name: unknown;
      priceCents: unknown;
    };

    if (
      typeof candidate.itemId !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.priceCents !== "number" ||
      candidate.name.trim().length === 0 ||
      candidate.priceCents < 0
    ) {
      throw new Error("INVALID_MENU_ITEMS");
    }

    return {
      itemId: candidate.itemId,
      name: candidate.name,
      priceCents: candidate.priceCents,
    };
  });

  return normalized;
}

function validateCreateMenuPayload(payload: Record<string, unknown>): CreateMenuInput {
  const merchantId = payload.merchantId;
  const storeId = payload.storeId;
  const name = payload.name;
  const items = payload.items;

  if (
    typeof merchantId !== "string" ||
    typeof storeId !== "string" ||
    typeof name !== "string" ||
    name.trim().length === 0
  ) {
    throw new Error("INVALID_MENU_CREATE_PAYLOAD");
  }

  return {
    merchantId,
    storeId,
    name,
    items: validateMenuItems(items),
  };
}

function validateUpdateMenuPayload(payload: Record<string, unknown>): UpdateMenuInput {
  const name = payload.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("INVALID_MENU_UPDATE_PAYLOAD");
  }

  return {
    name,
    items: validateMenuItems(payload.items),
  };
}

function isValidHHMM(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hours, minutes] = value.split(":").map((item) => Number(item));
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function validateStoreStatusPayload(payload: Record<string, unknown>): UpdateStoreStatusInput {
  const paused = payload.paused;
  const schedule = payload.schedule;

  if (
    typeof paused !== "boolean" ||
    typeof schedule !== "object" ||
    schedule === null ||
    !("open" in schedule) ||
    !("close" in schedule) ||
    !("timezone" in schedule)
  ) {
    throw new Error("INVALID_STORE_STATUS_PAYLOAD");
  }

  const normalizedSchedule = schedule as {
    open: unknown;
    close: unknown;
    timezone: unknown;
  };

  if (
    typeof normalizedSchedule.open !== "string" ||
    typeof normalizedSchedule.close !== "string" ||
    typeof normalizedSchedule.timezone !== "string" ||
    !isValidHHMM(normalizedSchedule.open) ||
    !isValidHHMM(normalizedSchedule.close) ||
    normalizedSchedule.timezone.trim().length === 0
  ) {
    throw new Error("INVALID_STORE_STATUS_PAYLOAD");
  }

  return {
    paused,
    schedule: {
      open: normalizedSchedule.open,
      close: normalizedSchedule.close,
      timezone: normalizedSchedule.timezone,
    },
  };
}

function validateItemAvailabilityPayload(payload: Record<string, unknown>): {
  available: boolean;
  reason?: string;
} {
  const available = payload.available;
  const reason = payload.reason;

  if (typeof available !== "boolean") {
    throw new Error("INVALID_ITEM_AVAILABILITY_PAYLOAD");
  }

  if (reason !== undefined && typeof reason !== "string") {
    throw new Error("INVALID_ITEM_AVAILABILITY_PAYLOAD");
  }

  return {
    available,
    reason,
  };
}

function validateCreateBasketPayload(payload: Record<string, unknown>): CreateBasketInput {
  const consumerId = payload.consumerId;
  const merchantId = payload.merchantId;
  const currency = payload.currency;

  if (
    typeof consumerId !== "string" ||
    typeof merchantId !== "string" ||
    typeof currency !== "string" ||
    currency.trim().length === 0
  ) {
    throw new Error("INVALID_BASKET_CREATE_PAYLOAD");
  }

  return {
    consumerId,
    merchantId,
    currency,
  };
}

function validateBasketItems(items: unknown): BasketItemInput[] {
  if (!Array.isArray(items)) {
    throw new Error("INVALID_BASKET_ITEMS");
  }

  return items.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("itemId" in item) ||
      !("name" in item) ||
      !("quantity" in item) ||
      !("unitPriceCents" in item) ||
      !("modifiers" in item)
    ) {
      throw new Error("INVALID_BASKET_ITEMS");
    }

    const candidate = item as {
      itemId: unknown;
      name: unknown;
      quantity: unknown;
      unitPriceCents: unknown;
      modifiers: unknown;
      note?: unknown;
    };

    if (
      typeof candidate.itemId !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.quantity !== "number" ||
      candidate.quantity <= 0 ||
      typeof candidate.unitPriceCents !== "number" ||
      candidate.unitPriceCents < 0 ||
      !Array.isArray(candidate.modifiers) ||
      !candidate.modifiers.every((modifier) => typeof modifier === "string") ||
      (candidate.note !== undefined && typeof candidate.note !== "string")
    ) {
      throw new Error("INVALID_BASKET_ITEMS");
    }

    return {
      itemId: candidate.itemId,
      name: candidate.name,
      quantity: candidate.quantity,
      unitPriceCents: candidate.unitPriceCents,
      modifiers: candidate.modifiers,
      note: candidate.note,
    };
  });
}

function validateUpdateBasketPayload(payload: Record<string, unknown>): UpdateBasketInput {
  return {
    items: validateBasketItems(payload.items),
  };
}

function validateUpsertDeliveryZonePayload(
  payload: Record<string, unknown>,
): UpsertDeliveryZoneInput {
  const zoneId = payload.zoneId;
  const name = payload.name;
  const minLat = payload.minLat;
  const maxLat = payload.maxLat;
  const minLng = payload.minLng;
  const maxLng = payload.maxLng;

  if (
    typeof zoneId !== "string" ||
    typeof name !== "string" ||
    typeof minLat !== "number" ||
    typeof maxLat !== "number" ||
    typeof minLng !== "number" ||
    typeof maxLng !== "number"
  ) {
    throw new Error("INVALID_DELIVERY_ZONE_PAYLOAD");
  }

  return {
    zoneId,
    name,
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
}

function validateZonePointPayload(payload: Record<string, unknown>): ValidateZonePointInput {
  const latitude = payload.latitude;
  const longitude = payload.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("INVALID_ZONE_POINT_PAYLOAD");
  }

  return {
    latitude,
    longitude,
  };
}

function validateGenerateQuotePayload(payload: Record<string, unknown>): {
  basketId: string;
  promoCode?: string;
} {
  const basketId = payload.basketId;
  const promoCode = payload.promoCode;

  if (
    typeof basketId !== "string" ||
    (promoCode !== undefined && typeof promoCode !== "string")
  ) {
    throw new Error("INVALID_QUOTE_PAYLOAD");
  }

  return {
    basketId,
    promoCode,
  };
}

function validatePromotionEvaluatePayload(payload: Record<string, unknown>): {
  consumerId: string;
  merchantId: string;
  subtotalCents: number;
  promoCode?: string;
} {
  const consumerId = payload.consumerId;
  const merchantId = payload.merchantId;
  const subtotalCents = payload.subtotalCents;
  const promoCode = payload.promoCode;

  if (
    typeof consumerId !== "string" ||
    typeof merchantId !== "string" ||
    typeof subtotalCents !== "number" ||
    subtotalCents < 0 ||
    (promoCode !== undefined && typeof promoCode !== "string")
  ) {
    throw new Error("INVALID_PROMOTION_EVALUATION_PAYLOAD");
  }

  return {
    consumerId,
    merchantId,
    subtotalCents,
    promoCode,
  };
}

function validateCheckoutPayload(payload: Record<string, unknown>): {
  basketId: string;
  quoteId: string;
  quoteHash: string;
} {
  const basketId = payload.basketId;
  const quoteId = payload.quoteId;
  const quoteHash = payload.quoteHash;

  if (
    typeof basketId !== "string" ||
    typeof quoteId !== "string" ||
    typeof quoteHash !== "string"
  ) {
    throw new Error("INVALID_CHECKOUT_PAYLOAD");
  }

  return {
    basketId,
    quoteId,
    quoteHash,
  };
}

function validateCreateOrderPayload(payload: Record<string, unknown>): {
  checkoutId: string;
  quoteHash: string;
} {
  const checkoutId = payload.checkoutId;
  const quoteHash = payload.quoteHash;

  if (typeof checkoutId !== "string" || typeof quoteHash !== "string") {
    throw new Error("INVALID_ORDER_CREATE_PAYLOAD");
  }

  return {
    checkoutId,
    quoteHash,
  };
}

function validateOrderCancellationPayload(payload: Record<string, unknown>): {
  reasonCode: string;
} {
  const reasonCode = payload.reasonCode;
  if (typeof reasonCode !== "string" || reasonCode.trim().length === 0) {
    throw new Error("INVALID_ORDER_CANCELLATION_PAYLOAD");
  }

  return {
    reasonCode,
  };
}

function validatePaymentAuthorizePayload(payload: Record<string, unknown>): {
  orderId: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
} {
  const orderId = payload.orderId;
  const method = payload.method;
  const amount = payload.amount;
  const currency = payload.currency;

  if (
    typeof orderId !== "string" ||
    typeof method !== "string" ||
    !["CARD", "APPLE_PAY", "GOOGLE_PAY", "CASH"].includes(method) ||
    typeof amount !== "number" ||
    amount <= 0 ||
    typeof currency !== "string" ||
    currency.trim().length !== 3
  ) {
    throw new Error("INVALID_PAYMENT_AUTHORIZE_PAYLOAD");
  }

  return {
    orderId,
    method: method as PaymentMethod,
    amount,
    currency: currency.toUpperCase(),
  };
}

function validatePaymentCapturePayload(payload: Record<string, unknown>): {
  paymentIntentId: string;
  idempotencyKey: string;
} {
  const paymentIntentId = payload.paymentIntentId;
  const idempotencyKey = payload.idempotencyKey;

  if (
    typeof paymentIntentId !== "string" ||
    paymentIntentId.trim().length === 0 ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0
  ) {
    throw new Error("INVALID_PAYMENT_CAPTURE_PAYLOAD");
  }

  return {
    paymentIntentId,
    idempotencyKey,
  };
}

function validateCashExpectedPayload(payload: Record<string, unknown>): {
  orderId: string;
  expectedAmount: number;
  currency: string;
} {
  const orderId = payload.orderId;
  const expectedAmount = payload.expectedAmount;
  const currency = payload.currency;

  if (
    typeof orderId !== "string" ||
    typeof expectedAmount !== "number" ||
    expectedAmount <= 0 ||
    typeof currency !== "string" ||
    currency.trim().length !== 3
  ) {
    throw new Error("INVALID_CASH_EXPECTED_PAYLOAD");
  }

  return {
    orderId,
    expectedAmount,
    currency: currency.toUpperCase(),
  };
}

function validateCashCollectionPayload(payload: Record<string, unknown>): {
  collectedAmount: number;
  courierId: string;
} {
  const collectedAmount = payload.collectedAmount;
  const courierId = payload.courierId;

  if (
    typeof collectedAmount !== "number" ||
    collectedAmount <= 0 ||
    typeof courierId !== "string" ||
    courierId.trim().length === 0
  ) {
    throw new Error("INVALID_CASH_COLLECTION_PAYLOAD");
  }

  return {
    collectedAmount,
    courierId,
  };
}

function validateRefundRequestPayload(payload: Record<string, unknown>): {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  reasonCode: string;
  requestedBy: string;
} {
  const orderId = payload.orderId;
  const paymentIntentId = payload.paymentIntentId;
  const amount = payload.amount;
  const reasonCode = payload.reasonCode;
  const requestedBy = payload.requestedBy;

  if (
    typeof orderId !== "string" ||
    typeof paymentIntentId !== "string" ||
    typeof amount !== "number" ||
    amount <= 0 ||
    typeof reasonCode !== "string" ||
    reasonCode.trim().length === 0 ||
    typeof requestedBy !== "string" ||
    requestedBy.trim().length === 0
  ) {
    throw new Error("INVALID_REFUND_REQUEST_PAYLOAD");
  }

  return {
    orderId,
    paymentIntentId,
    amount,
    reasonCode,
    requestedBy,
  };
}

function validateRefundApprovalPayload(payload: Record<string, unknown>): {
  approvedBy: string;
} {
  const approvedBy = payload.approvedBy;
  if (typeof approvedBy !== "string" || approvedBy.trim().length === 0) {
    throw new Error("INVALID_REFUND_APPROVAL_PAYLOAD");
  }

  return {
    approvedBy,
  };
}

function validateSettlementJournalPayload(payload: Record<string, unknown>): PostSettlementJournalInput {
  const sourceType = payload.sourceType;
  const sourceId = payload.sourceId;
  const lines = payload.lines;

  if (
    typeof sourceType !== "string" ||
    sourceType.trim().length === 0 ||
    typeof sourceId !== "string" ||
    sourceId.trim().length === 0 ||
    !Array.isArray(lines) ||
    lines.length < 2
  ) {
    throw new Error("INVALID_SETTLEMENT_JOURNAL_PAYLOAD");
  }

  const normalizedLines = lines.map((line) => {
    if (
      typeof line !== "object" ||
      line === null ||
      !("account" in line) ||
      !("side" in line) ||
      !("amount" in line)
    ) {
      throw new Error("INVALID_SETTLEMENT_JOURNAL_PAYLOAD");
    }

    const candidate = line as {
      account: unknown;
      side: unknown;
      amount: unknown;
    };

    if (
      typeof candidate.account !== "string" ||
      candidate.account.trim().length === 0 ||
      typeof candidate.side !== "string" ||
      !["DEBIT", "CREDIT"].includes(candidate.side) ||
      typeof candidate.amount !== "number" ||
      candidate.amount <= 0
    ) {
      throw new Error("INVALID_SETTLEMENT_JOURNAL_PAYLOAD");
    }

    return {
      account: candidate.account,
      side: candidate.side as LedgerSide,
      amount: candidate.amount,
    };
  });

  return {
    sourceType,
    sourceId,
    lines: normalizedLines,
  };
}

function validatePayoutBatchPayload(payload: Record<string, unknown>): GeneratePayoutBatchInput {
  const scheduleId = payload.scheduleId;
  const runAt = payload.runAt;
  const candidates = payload.candidates;

  if (
    typeof scheduleId !== "string" ||
    scheduleId.trim().length === 0 ||
    typeof runAt !== "string" ||
    Number.isNaN(new Date(runAt).getTime()) ||
    !Array.isArray(candidates)
  ) {
    throw new Error("INVALID_PAYOUT_BATCH_PAYLOAD");
  }

  const normalizedCandidates = candidates.map((candidate) => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("entityType" in candidate) ||
      !("entityId" in candidate) ||
      !("amount" in candidate) ||
      !("hasException" in candidate)
    ) {
      throw new Error("INVALID_PAYOUT_BATCH_PAYLOAD");
    }

    const normalized = candidate as {
      entityType: unknown;
      entityId: unknown;
      amount: unknown;
      hasException: unknown;
      holdReason?: unknown;
    };

    if (
      typeof normalized.entityType !== "string" ||
      !["MERCHANT", "COURIER"].includes(normalized.entityType) ||
      typeof normalized.entityId !== "string" ||
      normalized.entityId.trim().length === 0 ||
      typeof normalized.amount !== "number" ||
      normalized.amount < 0 ||
      typeof normalized.hasException !== "boolean" ||
      (normalized.holdReason !== undefined && typeof normalized.holdReason !== "string")
    ) {
      throw new Error("INVALID_PAYOUT_BATCH_PAYLOAD");
    }

    return {
      entityType: normalized.entityType as PayoutEntityType,
      entityId: normalized.entityId,
      amount: normalized.amount,
      hasException: normalized.hasException,
      holdReason: normalized.holdReason as string | undefined,
    };
  });

  return {
    scheduleId,
    runAt,
    candidates: normalizedCandidates,
  };
}

function validatePublishPayoutStatementPayload(
  payload: Record<string, unknown>,
): PublishPayoutStatementInput {
  const payoutBatchId = payload.payoutBatchId;
  const entityType = payload.entityType;
  const entityId = payload.entityId;
  const periodStart = payload.periodStart;
  const periodEnd = payload.periodEnd;
  const currency = payload.currency;
  const totalAmount = payload.totalAmount;
  const lineItems = payload.lineItems;

  if (
    typeof payoutBatchId !== "string" ||
    payoutBatchId.trim().length === 0 ||
    typeof entityType !== "string" ||
    !["MERCHANT", "COURIER"].includes(entityType) ||
    typeof entityId !== "string" ||
    entityId.trim().length === 0 ||
    typeof periodStart !== "string" ||
    Number.isNaN(new Date(periodStart).getTime()) ||
    typeof periodEnd !== "string" ||
    Number.isNaN(new Date(periodEnd).getTime()) ||
    typeof currency !== "string" ||
    currency.trim().length === 0 ||
    typeof totalAmount !== "number" ||
    !Array.isArray(lineItems)
  ) {
    throw new Error("INVALID_PAYOUT_STATEMENT_PAYLOAD");
  }

  const normalizedLineItems = lineItems.map((lineItem) => {
    if (
      typeof lineItem !== "object" ||
      lineItem === null ||
      !("label" in lineItem) ||
      !("amount" in lineItem)
    ) {
      throw new Error("INVALID_PAYOUT_STATEMENT_PAYLOAD");
    }

    const normalized = lineItem as {
      label: unknown;
      amount: unknown;
    };

    if (
      typeof normalized.label !== "string" ||
      normalized.label.trim().length === 0 ||
      typeof normalized.amount !== "number"
    ) {
      throw new Error("INVALID_PAYOUT_STATEMENT_PAYLOAD");
    }

    return {
      label: normalized.label,
      amount: normalized.amount,
    };
  });

  return {
    payoutBatchId,
    entityType: entityType as PayoutEntityType,
    entityId,
    periodStart,
    periodEnd,
    currency,
    totalAmount,
    lineItems: normalizedLineItems,
  };
}

function validateNotificationFanoutPayload(payload: Record<string, unknown>): QueueNotificationInput {
  const eventType = payload.eventType;
  const entityId = payload.entityId;
  const recipientId = payload.recipientId;

  if (
    typeof eventType !== "string" ||
    eventType.trim().length === 0 ||
    typeof entityId !== "string" ||
    entityId.trim().length === 0 ||
    typeof recipientId !== "string" ||
    recipientId.trim().length === 0
  ) {
    throw new Error("INVALID_NOTIFICATION_FANOUT_PAYLOAD");
  }

  return {
    eventType,
    entityId,
    recipientId,
  };
}

function validateNotificationRetryPayload(
  payload: Record<string, unknown>,
): HandleNotificationFailureInput {
  const notificationId = payload.notificationId;
  const eventType = payload.eventType;
  const channel = payload.channel;
  const entityId = payload.entityId;
  const currentAttempt = payload.currentAttempt;
  const errorCode = payload.errorCode;
  const retriable = payload.retriable;

  if (
    typeof notificationId !== "string" ||
    notificationId.trim().length === 0 ||
    typeof eventType !== "string" ||
    eventType.trim().length === 0 ||
    typeof channel !== "string" ||
    !["PUSH", "SMS", "EMAIL"].includes(channel) ||
    typeof entityId !== "string" ||
    entityId.trim().length === 0 ||
    typeof currentAttempt !== "number" ||
    currentAttempt < 0 ||
    !Number.isInteger(currentAttempt) ||
    typeof errorCode !== "string" ||
    errorCode.trim().length === 0 ||
    typeof retriable !== "boolean"
  ) {
    throw new Error("INVALID_NOTIFICATION_RETRY_PAYLOAD");
  }

  return {
    notificationId,
    eventType,
    channel: channel as HandleNotificationFailureInput["channel"],
    entityId,
    currentAttempt,
    errorCode,
    retriable,
  };
}

function extractBearerToken(request: IncomingMessage): string {
  const authorization = request.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new Error("MISSING_BEARER_TOKEN");
  }

  return authorization.replace("Bearer ", "").trim();
}

export function createServer() {
  const repository = new InMemoryIdentityRepository();
  const eventBus = new InMemoryEventBus();
  const identityService = new IdentityService(repository, eventBus);
  const sessionStore = new InMemorySessionStore();
  const authService = new AuthService(
    repository,
    eventBus,
    sessionStore,
    process.env.JWT_SECRET ?? "dev-jwt-secret",
  );
  const menuRepository = new InMemoryMenuRepository();
  const menuService = new MenuService(menuRepository);
  const prepTimeService = new PrepTimeService(menuRepository);
  const storeStatusRepository = new InMemoryStoreStatusRepository();
  const storeStatusService = new StoreStatusService(storeStatusRepository);
  const itemAvailabilityRepository = new InMemoryItemAvailabilityRepository();
  const itemAvailabilityService = new ItemAvailabilityService(itemAvailabilityRepository);
  const basketRepository = new InMemoryBasketRepository();
  const basketService = new BasketService(basketRepository, itemAvailabilityService);
  const quoteRepository = new InMemoryQuoteRepository();
  const checkoutRepository = new InMemoryCheckoutRepository();
  const quoteService = new QuoteService(basketRepository, quoteRepository);
  const checkoutService = new CheckoutService(quoteRepository, checkoutRepository);
  const orderRepository = new InMemoryOrderRepository();
  const orderTimelineRepository = new InMemoryOrderTimelineRepository();
  const orderTimelineService = new OrderTimelineService(eventBus, orderTimelineRepository);
  const orderService = new OrderService(
    checkoutRepository,
    orderRepository,
    eventBus,
    orderTimelineService,
  );
  const paymentIntentRepository = new InMemoryPaymentIntentRepository();
  const refundRequestRepository = new InMemoryRefundRequestRepository();
  const paymentAuditRepository = new InMemoryPaymentAuditRepository();
  const paymentService = new PaymentService(
    orderRepository,
    paymentIntentRepository,
    new InMemoryPSPAdapter(),
    eventBus,
    refundRequestRepository,
    paymentAuditRepository,
  );
  const settlementLedgerService = new SettlementLedgerService(
    new InMemorySettlementLedgerRepository(),
    eventBus,
  );
  const payoutService = new PayoutService(new InMemoryPayoutBatchRepository(), eventBus);
  const payoutStatementService = new PayoutStatementService(
    new InMemoryPayoutStatementRepository(),
    eventBus,
  );
  const notificationFanoutService = new NotificationFanoutService(
    new InMemoryNotificationQueueRepository(),
    eventBus,
  );
  const notificationRetryService = new NotificationRetryService(
    new InMemoryNotificationRetryRepository(),
    eventBus,
  );
  const deliveryZoneRepository = new InMemoryDeliveryZoneRepository();
  const deliveryZoneService = new DeliveryZoneService(deliveryZoneRepository);

  return createHttpServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      const pathname = requestUrl.pathname;

      const menuRouteMatch = pathname.match(/^\/api\/v1\/merchant\/catalog\/menus\/([^/]+)$/);
      const menuVersionsRouteMatch = pathname.match(
        /^\/api\/v1\/merchant\/catalog\/menus\/([^/]+)\/versions$/,
      );
      const storeStatusRouteMatch = pathname.match(
        /^\/api\/v1\/merchant\/stores\/([^/]+)\/status$/,
      );
      const storeOrderabilityRouteMatch = pathname.match(
        /^\/internal\/catalog\/stores\/([^/]+)\/orderability$/,
      );
      const storePrepTimeRouteMatch = pathname.match(
        /^\/internal\/catalog\/stores\/([^/]+)\/prep-time$/,
      );
      const itemAvailabilityUpdateRouteMatch = pathname.match(
        /^\/api\/v1\/merchant\/items\/([^/]+)\/availability$/,
      );
      const itemAvailabilityReadRouteMatch = pathname.match(
        /^\/internal\/catalog\/items\/([^/]+)\/availability$/,
      );
      const consumerBasketRouteMatch = pathname.match(/^\/api\/v1\/consumer\/baskets\/([^/]+)$/);
      const courierCashCollectionRouteMatch = pathname.match(
        /^\/api\/v1\/courier\/orders\/([^/]+)\/cash-collection$/,
      );
      const consumerOrderTimelineRouteMatch = pathname.match(
        /^\/api\/v1\/consumer\/orders\/([^/]+)\/timeline$/,
      );
      const consumerOrderCancelRouteMatch = pathname.match(
        /^\/api\/v1\/consumer\/orders\/([^/]+)\/cancel$/,
      );
      const merchantOrderAcceptRouteMatch = pathname.match(
        /^\/api\/v1\/merchant\/orders\/([^/]+)\/accept$/,
      );
      const merchantOrderTimeoutRouteMatch = pathname.match(
        /^\/internal\/orders\/([^/]+)\/merchant-timeout$/,
      );
      const orderDispatchRequestRouteMatch = pathname.match(
        /^\/internal\/orders\/([^/]+)\/request-dispatch$/,
      );
      const refundApprovalRouteMatch = pathname.match(
        /^\/internal\/payments\/refunds\/([^/]+)\/approve$/,
      );
      const paymentAuditRouteMatch = pathname.match(/^\/internal\/payments\/audit\/([^/]+)$/);

      if (request.method === "GET" && pathname === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/identity/register") {
        const payload = await parseJsonBody(request);
        const input = validateRegistrationPayload(payload);
        const user = await identityService.register(input);

        sendJson(response, 201, {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          createdAt: user.createdAt,
        });
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/identity/login") {
        const payload = await parseJsonBody(request);
        const input = validateLoginPayload(payload);
        const tokens = await authService.login(input);
        sendJson(response, 200, tokens);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/identity/token/refresh") {
        const payload = await parseJsonBody(request);
        const input = validateRefreshPayload(payload);
        const tokens = await authService.refresh(input.refreshToken);
        sendJson(response, 200, tokens);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/identity/mfa/verify") {
        const payload = await parseJsonBody(request);
        const input = validateMfaVerifyPayload(payload);
        const tokens = await authService.login(input);
        sendJson(response, 200, tokens);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/admin/delivery-zones") {
        const payload = await parseJsonBody(request);
        const input = validateUpsertDeliveryZonePayload(payload);
        const zone = await deliveryZoneService.upsertZone(input);
        sendJson(response, 201, zone);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/consumer/quotes/validate-zone") {
        const payload = await parseJsonBody(request);
        const input = validateZonePointPayload(payload);
        const result = await deliveryZoneService.validatePoint(input);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/consumer/quotes") {
        const payload = await parseJsonBody(request);
        const input = validateGenerateQuotePayload(payload);
        const quote = await quoteService.generateQuote(input);
        sendJson(response, 200, quote);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/consumer/promotions/evaluate") {
        const payload = await parseJsonBody(request);
        const input = validatePromotionEvaluatePayload(payload);
        const result = quoteService.evaluatePromotion(input);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/consumer/checkout") {
        const payload = await parseJsonBody(request);
        const input = validateCheckoutPayload(payload);
        const checkout = await checkoutService.createCheckout(input);
        sendJson(response, 200, checkout);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/consumer/orders") {
        const payload = await parseJsonBody(request);
        const input = validateCreateOrderPayload(payload);
        const order = await orderService.createOrder(input);
        sendJson(response, 201, order);
        return;
      }

      if (request.method === "GET" && consumerOrderTimelineRouteMatch) {
        const orderId = decodeURIComponent(consumerOrderTimelineRouteMatch[1] ?? "");
        const entries = orderTimelineService.getTimeline(orderId);
        sendJson(response, 200, { orderId, entries });
        return;
      }

      if (request.method === "POST" && consumerOrderCancelRouteMatch) {
        const payload = await parseJsonBody(request);
        const input = validateOrderCancellationPayload(payload);
        const orderId = decodeURIComponent(consumerOrderCancelRouteMatch[1] ?? "");
        const order = await orderService.requestCancellation(orderId, {
          actor: "consumer",
          reasonCode: input.reasonCode,
        });
        sendJson(response, 200, order);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/payments/authorize") {
        const payload = await parseJsonBody(request);
        const input = validatePaymentAuthorizePayload(payload);
        const paymentIntent = await paymentService.authorizePayment(input);
        sendJson(response, 201, paymentIntent);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/payments/capture") {
        const payload = await parseJsonBody(request);
        const input = validatePaymentCapturePayload(payload);
        const paymentIntent = await paymentService.capturePayment(input);
        sendJson(response, 200, paymentIntent);
        return;
      }

      if (request.method === "POST" && pathname === "/internal/payments/cash/expected") {
        const payload = await parseJsonBody(request);
        const input = validateCashExpectedPayload(payload);
        const expectation = await paymentService.markCashExpected(input);
        sendJson(response, 201, expectation);
        return;
      }

      if (request.method === "POST" && courierCashCollectionRouteMatch) {
        const payload = await parseJsonBody(request);
        const input = validateCashCollectionPayload(payload);
        const orderId = decodeURIComponent(courierCashCollectionRouteMatch[1] ?? "");
        const result = await paymentService.confirmCashCollection({
          orderId,
          collectedAmount: input.collectedAmount,
          courierId: input.courierId,
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/support/refunds") {
        const payload = await parseJsonBody(request);
        const input = validateRefundRequestPayload(payload);
        const refund = await paymentService.requestRefund(input);
        sendJson(response, 201, refund);
        return;
      }

      if (request.method === "POST" && refundApprovalRouteMatch) {
        const payload = await parseJsonBody(request);
        const input = validateRefundApprovalPayload(payload);
        const refundRequestId = decodeURIComponent(refundApprovalRouteMatch[1] ?? "");
        const refund = await paymentService.approveRefund({
          refundRequestId,
          approvedBy: input.approvedBy,
        });
        sendJson(response, 200, refund);
        return;
      }

      if (request.method === "GET" && paymentAuditRouteMatch) {
        const orderId = decodeURIComponent(paymentAuditRouteMatch[1] ?? "");
        const records = await paymentService.getAuditTrail(orderId);
        sendJson(response, 200, { orderId, records });
        return;
      }

      if (request.method === "POST" && pathname === "/internal/settlement/ledger/entries") {
        const payload = await parseJsonBody(request);
        const input = validateSettlementJournalPayload(payload);
        const journal = await settlementLedgerService.postJournalEntry(input);
        sendJson(response, 201, journal);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/admin/payouts/generate") {
        const payload = await parseJsonBody(request);
        const input = validatePayoutBatchPayload(payload);
        const batch = await payoutService.generateBatch(input);
        sendJson(response, 201, batch);
        return;
      }

      if (request.method === "POST" && pathname === "/internal/settlement/payout-statements/publish") {
        const payload = await parseJsonBody(request);
        const input = validatePublishPayoutStatementPayload(payload);
        const statement = await payoutStatementService.publishStatement(input);
        sendJson(response, 201, statement);
        return;
      }

      if (request.method === "GET" && pathname === "/api/v1/merchant/payouts") {
        const merchantId = requestUrl.searchParams.get("merchantId");
        if (!merchantId || merchantId.trim().length === 0) {
          throw new Error("INVALID_MERCHANT_PAYOUT_QUERY");
        }

        const statements = payoutStatementService.listStatements("MERCHANT", merchantId);
        sendJson(response, 200, { statements });
        return;
      }

      if (request.method === "GET" && pathname === "/api/v1/courier/payouts") {
        const courierId = requestUrl.searchParams.get("courierId");
        if (!courierId || courierId.trim().length === 0) {
          throw new Error("INVALID_COURIER_PAYOUT_QUERY");
        }

        const statements = payoutStatementService.listStatements("COURIER", courierId);
        sendJson(response, 200, { statements });
        return;
      }

      if (request.method === "POST" && pathname === "/internal/notifications/fanout") {
        const payload = await parseJsonBody(request);
        const input = validateNotificationFanoutPayload(payload);
        const result = await notificationFanoutService.fanout(input);
        sendJson(response, 202, {
          queuedCount: result.queued.length,
          queued: result.queued,
        });
        return;
      }

      if (request.method === "POST" && pathname === "/internal/notifications/retry") {
        const payload = await parseJsonBody(request);
        const input = validateNotificationRetryPayload(payload);
        const decision = await notificationRetryService.handleFailure(input);
        sendJson(response, 202, decision);
        return;
      }

      if (request.method === "POST" && merchantOrderAcceptRouteMatch) {
        const orderId = decodeURIComponent(merchantOrderAcceptRouteMatch[1] ?? "");
        const order = await orderService.merchantAcceptOrder(orderId);
        sendJson(response, 200, order);
        return;
      }

      if (request.method === "POST" && merchantOrderTimeoutRouteMatch) {
        const orderId = decodeURIComponent(merchantOrderTimeoutRouteMatch[1] ?? "");
        const order = await orderService.handleMerchantDecisionTimeout(orderId);
        sendJson(response, 200, order);
        return;
      }

      if (request.method === "POST" && orderDispatchRequestRouteMatch) {
        const orderId = decodeURIComponent(orderDispatchRequestRouteMatch[1] ?? "");
        const order = await orderService.requestDispatch(orderId);
        sendJson(response, 200, order);
        return;
      }

      if (request.method === "POST" && pathname === "/internal/orders/timeline/rebuild") {
        const result = orderTimelineService.rebuildFromEventLog();
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/consumer/baskets") {
        const payload = await parseJsonBody(request);
        const input = validateCreateBasketPayload(payload);
        const basket = await basketService.createBasket(input);
        sendJson(response, 201, basket);
        return;
      }

      if (request.method === "PATCH" && consumerBasketRouteMatch) {
        const payload = await parseJsonBody(request);
        const input = validateUpdateBasketPayload(payload);
        const basketId = decodeURIComponent(consumerBasketRouteMatch[1] ?? "");
        const basket = await basketService.updateBasket(basketId, input);
        sendJson(response, 200, basket);
        return;
      }

      if (request.method === "GET" && consumerBasketRouteMatch) {
        const basketId = decodeURIComponent(consumerBasketRouteMatch[1] ?? "");
        const basket = await basketService.getBasket(basketId);
        sendJson(response, 200, basket);
        return;
      }

      if (request.method === "POST" && pathname === "/api/v1/merchant/catalog/menus") {
        const payload = await parseJsonBody(request);
        const input = validateCreateMenuPayload(payload);
        const menu = await menuService.createMenu(input);
        sendJson(response, 201, menu);
        return;
      }

      if (request.method === "PUT" && menuRouteMatch) {
        const payload = await parseJsonBody(request);
        const input = validateUpdateMenuPayload(payload);
        const menuId = decodeURIComponent(menuRouteMatch[1] ?? "");
        const menu = await menuService.updateMenu(menuId, input);
        sendJson(response, 200, menu);
        return;
      }

      if (request.method === "GET" && menuVersionsRouteMatch) {
        const menuId = decodeURIComponent(menuVersionsRouteMatch[1] ?? "");
        const versions = await menuService.getMenuVersions(menuId);
        sendJson(response, 200, { versions });
        return;
      }

      if (request.method === "GET" && menuRouteMatch) {
        const menuId = decodeURIComponent(menuRouteMatch[1] ?? "");
        const menu = await menuService.getMenu(menuId);
        sendJson(response, 200, menu);
        return;
      }

      if (request.method === "POST" && storeStatusRouteMatch) {
        const payload = await parseJsonBody(request);
        const input = validateStoreStatusPayload(payload);
        const storeId = decodeURIComponent(storeStatusRouteMatch[1] ?? "");
        const status = await storeStatusService.setStatus(storeId, input);
        sendJson(response, 200, status);
        return;
      }

      if (request.method === "GET" && storeOrderabilityRouteMatch) {
        const storeId = decodeURIComponent(storeOrderabilityRouteMatch[1] ?? "");
        const at = requestUrl.searchParams.get("at");
        const atDate = at ? new Date(at) : new Date();
        if (Number.isNaN(atDate.getTime())) {
          throw new Error("INVALID_ORDERABILITY_QUERY");
        }

        const result = await storeStatusService.evaluateOrderability(storeId, atDate);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && storePrepTimeRouteMatch) {
        const storeId = decodeURIComponent(storePrepTimeRouteMatch[1] ?? "");
        const estimate = await prepTimeService.getEstimate(storeId);
        sendJson(response, 200, estimate);
        return;
      }

      if (request.method === "POST" && itemAvailabilityUpdateRouteMatch) {
        const payload = await parseJsonBody(request);
        const input = validateItemAvailabilityPayload(payload);
        const itemId = decodeURIComponent(itemAvailabilityUpdateRouteMatch[1] ?? "");
        const result = await itemAvailabilityService.setAvailability(itemId, input);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && itemAvailabilityReadRouteMatch) {
        const itemId = decodeURIComponent(itemAvailabilityReadRouteMatch[1] ?? "");
        const result = await itemAvailabilityService.getAvailability(itemId);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && pathname === "/api/v1/admin/health") {
        const token = extractBearerToken(request);
        const claims = authService.verifyAccessToken(token);
        if (!isAllowed(claims.role, "admin:read")) {
          sendJson(response, 403, {
            errorCode: "IDENTITY_PERMISSION_DENIED",
            message: "Permission denied.",
          });
          return;
        }

        sendJson(response, 200, {
          status: "ok",
          scope: "admin",
        });
        return;
      }

      sendJson(response, 404, { errorCode: "NOT_FOUND", message: "Route not found" });
    } catch (error) {
      if (error instanceof DuplicateIdentityError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof AuthError) {
        sendJson(response, 401, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof MenuNotFoundError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof BasketNotFoundError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof QuoteBasketNotFoundError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof StaleQuoteError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof InvalidCheckoutError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof QuoteHashMismatchError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof OrderNotFoundError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof PaymentOrderNotFoundError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof PaymentIntentNotFoundError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof PaymentCapturePreconditionError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof PaymentCashExpectationNotFoundError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof PaymentRefundRequestNotFoundError) {
        sendJson(response, 404, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof PaymentRefundAmountInvalidError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof UnbalancedJournalError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof PaymentMethodNotSupportedError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof CancellationNotAllowedError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof BasketItemUnavailableError) {
        sendJson(response, 409, {
          errorCode: error.code,
          message: error.message,
          itemIds: error.itemIds,
        });
        return;
      }

      if (
        error instanceof SyntaxError ||
        (error instanceof Error &&
          [
            "INVALID_REGISTRATION_PAYLOAD",
            "INVALID_LOGIN_PAYLOAD",
            "INVALID_REFRESH_PAYLOAD",
            "INVALID_MFA_VERIFY_PAYLOAD",
            "INVALID_MENU_ITEMS",
            "INVALID_MENU_CREATE_PAYLOAD",
            "INVALID_MENU_UPDATE_PAYLOAD",
            "INVALID_STORE_STATUS_PAYLOAD",
            "INVALID_ORDERABILITY_QUERY",
            "INVALID_ITEM_AVAILABILITY_PAYLOAD",
            "INVALID_BASKET_CREATE_PAYLOAD",
            "INVALID_BASKET_ITEMS",
            "INVALID_DELIVERY_ZONE_PAYLOAD",
            "INVALID_ZONE_POINT_PAYLOAD",
            "INVALID_QUOTE_PAYLOAD",
            "INVALID_PROMOTION_EVALUATION_PAYLOAD",
            "INVALID_CHECKOUT_PAYLOAD",
            "INVALID_ORDER_CREATE_PAYLOAD",
            "INVALID_ORDER_CANCELLATION_PAYLOAD",
            "INVALID_PAYMENT_AUTHORIZE_PAYLOAD",
            "INVALID_PAYMENT_CAPTURE_PAYLOAD",
            "INVALID_CASH_EXPECTED_PAYLOAD",
            "INVALID_CASH_COLLECTION_PAYLOAD",
            "INVALID_REFUND_REQUEST_PAYLOAD",
            "INVALID_REFUND_APPROVAL_PAYLOAD",
            "INVALID_SETTLEMENT_JOURNAL_PAYLOAD",
            "INVALID_PAYOUT_BATCH_PAYLOAD",
            "INVALID_PAYOUT_STATEMENT_PAYLOAD",
            "INVALID_MERCHANT_PAYOUT_QUERY",
            "INVALID_COURIER_PAYOUT_QUERY",
            "INVALID_NOTIFICATION_FANOUT_PAYLOAD",
            "INVALID_NOTIFICATION_RETRY_PAYLOAD",
            "MISSING_BEARER_TOKEN",
          ].includes(error.message))
      ) {
        if (error instanceof Error && error.message === "MISSING_BEARER_TOKEN") {
          sendJson(response, 401, {
            errorCode: "IDENTITY_MISSING_TOKEN",
            message: "Bearer token is required.",
          });
          return;
        }

        sendJson(response, 400, {
          errorCode: "INVALID_REQUEST",
          message: "Invalid request payload",
        });
        return;
      }

      sendJson(response, 500, {
        errorCode: "INTERNAL_ERROR",
        message: "Unexpected server error",
      });
    }
  });
}
