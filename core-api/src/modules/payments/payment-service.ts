import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryOrderRepository } from "../order-orchestration/in-memory-order-repository.js";
import { InMemoryPaymentAuditRepository } from "./in-memory-payment-audit-repository.js";
import { InMemoryPaymentIntentRepository } from "./in-memory-payment-intent-repository.js";
import { InMemoryRefundRequestRepository } from "./in-memory-refund-request-repository.js";
import type { PSPAdapter } from "./in-memory-psp-adapter.js";
import type {
  ApproveRefundInput,
  AuthorizePaymentInput,
  CapturePaymentInput,
  CashCollectionResult,
  ConfirmCashCollectionInput,
  MarkCashExpectedInput,
  PaymentAuditRecord,
  PaymentIntent,
  RefundRequest,
  RequestRefundInput,
} from "./types.js";

export class PaymentOrderNotFoundError extends Error {
  code = "PAYMENT_ORDER_NOT_FOUND";

  constructor(orderId: string) {
    super(`Order '${orderId}' was not found.`);
    this.name = "PaymentOrderNotFoundError";
  }
}

export class PaymentMethodNotSupportedError extends Error {
  code = "PAYMENT_METHOD_NOT_SUPPORTED";

  constructor(method: string) {
    super(`Payment method '${method}' is not supported for authorization.`);
    this.name = "PaymentMethodNotSupportedError";
  }
}

export class PaymentIntentNotFoundError extends Error {
  code = "PAYMENT_INTENT_NOT_FOUND";

  constructor(paymentIntentId: string) {
    super(`Payment intent '${paymentIntentId}' was not found.`);
    this.name = "PaymentIntentNotFoundError";
  }
}

export class PaymentCapturePreconditionError extends Error {
  code = "PAYMENT_CAPTURE_PRECONDITION_FAILED";

  constructor(orderId: string, status: string) {
    super(`Capture preconditions failed for order '${orderId}' in status '${status}'.`);
    this.name = "PaymentCapturePreconditionError";
  }
}

export class PaymentCashExpectationNotFoundError extends Error {
  code = "PAYMENT_CASH_EXPECTATION_NOT_FOUND";

  constructor(orderId: string) {
    super(`Cash expectation for order '${orderId}' was not found.`);
    this.name = "PaymentCashExpectationNotFoundError";
  }
}

export class PaymentRefundAmountInvalidError extends Error {
  code = "PAYMENT_REFUND_AMOUNT_INVALID";

  constructor(amount: number) {
    super(`Refund amount '${amount}' is invalid for captured payment.`);
    this.name = "PaymentRefundAmountInvalidError";
  }
}

export class PaymentRefundRequestNotFoundError extends Error {
  code = "PAYMENT_REFUND_REQUEST_NOT_FOUND";

  constructor(refundRequestId: string) {
    super(`Refund request '${refundRequestId}' was not found.`);
    this.name = "PaymentRefundRequestNotFoundError";
  }
}

export class PaymentService {
  private readonly captureByIdempotencyKey = new Map<string, PaymentIntent>();

  constructor(
    private readonly orderRepository: InMemoryOrderRepository,
    private readonly paymentIntentRepository: InMemoryPaymentIntentRepository,
    private readonly pspAdapter: PSPAdapter,
    private readonly eventBus: InMemoryEventBus,
    private readonly refundRequestRepository: InMemoryRefundRequestRepository = new InMemoryRefundRequestRepository(),
    private readonly paymentAuditRepository: InMemoryPaymentAuditRepository = new InMemoryPaymentAuditRepository(),
  ) {}

  async authorizePayment(input: AuthorizePaymentInput): Promise<PaymentIntent> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new PaymentOrderNotFoundError(input.orderId);
    }

    if (input.method === "CASH") {
      throw new PaymentMethodNotSupportedError(input.method);
    }

    const authorization = await this.pspAdapter.authorize({
      orderId: input.orderId,
      method: input.method,
      amount: input.amount,
      currency: input.currency,
    });

    const paymentIntent: PaymentIntent = {
      paymentIntentId: randomUUID(),
      orderId: input.orderId,
      method: input.method,
      status: "AUTHORIZED",
      amount: input.amount,
      currency: input.currency,
      providerReference: authorization.providerReference,
      createdAt: authorization.authorizedAt,
      updatedAt: authorization.authorizedAt,
    };

    await this.paymentIntentRepository.save(paymentIntent);
    this.eventBus.publish({
      type: "payment.authorized.v1",
      occurredAt: authorization.authorizedAt,
      payload: {
        orderId: input.orderId,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: input.amount,
        currency: input.currency,
      },
    });
    await this.appendAuditRecord({
      orderId: input.orderId,
      actionType: "PAYMENT_AUTHORIZED",
      targetId: paymentIntent.paymentIntentId,
      reasonCode: "PAYMENT_AUTHORIZED",
      timestamp: authorization.authorizedAt,
      metadata: {
        amount: input.amount,
        currency: input.currency,
        method: input.method,
      },
    });

    return paymentIntent;
  }

  async capturePayment(input: CapturePaymentInput): Promise<PaymentIntent> {
    const existing = this.captureByIdempotencyKey.get(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const paymentIntent = await this.paymentIntentRepository.findById(input.paymentIntentId);
    if (!paymentIntent) {
      throw new PaymentIntentNotFoundError(input.paymentIntentId);
    }

    const order = await this.orderRepository.findById(paymentIntent.orderId);
    if (!order) {
      throw new PaymentOrderNotFoundError(paymentIntent.orderId);
    }

    if (paymentIntent.status === "CAPTURED") {
      this.captureByIdempotencyKey.set(input.idempotencyKey, paymentIntent);
      return paymentIntent;
    }

    if (!["MERCHANT_ACCEPTED", "DISPATCH_PENDING"].includes(order.status)) {
      throw new PaymentCapturePreconditionError(order.id, order.status);
    }

    const capturedAt = new Date().toISOString();
    const captured: PaymentIntent = {
      ...paymentIntent,
      status: "CAPTURED",
      updatedAt: capturedAt,
    };

    await this.paymentIntentRepository.save(captured);
    this.captureByIdempotencyKey.set(input.idempotencyKey, captured);
    this.eventBus.publish({
      type: "payment.captured.v1",
      occurredAt: capturedAt,
      payload: {
        orderId: order.id,
        paymentIntentId: captured.paymentIntentId,
        capturedAmount: captured.amount,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await this.appendAuditRecord({
      orderId: order.id,
      actionType: "PAYMENT_CAPTURED",
      targetId: captured.paymentIntentId,
      reasonCode: "PAYMENT_CAPTURED",
      timestamp: capturedAt,
      metadata: {
        capturedAmount: captured.amount,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return captured;
  }

  async markCashExpected(input: MarkCashExpectedInput): Promise<PaymentIntent> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new PaymentOrderNotFoundError(input.orderId);
    }

    const now = new Date().toISOString();
    const intent: PaymentIntent = {
      paymentIntentId: randomUUID(),
      orderId: input.orderId,
      method: "CASH",
      status: "INITIATED",
      amount: input.expectedAmount,
      currency: input.currency,
      providerReference: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.paymentIntentRepository.save(intent);
    this.eventBus.publish({
      type: "payment.cash_expected.v1",
      occurredAt: now,
      payload: {
        orderId: input.orderId,
        paymentIntentId: intent.paymentIntentId,
        expectedAmount: input.expectedAmount,
        currency: input.currency,
      },
    });
    await this.appendAuditRecord({
      orderId: input.orderId,
      actionType: "PAYMENT_CASH_EXPECTED",
      targetId: intent.paymentIntentId,
      reasonCode: "CASH_EXPECTED",
      timestamp: now,
      metadata: {
        expectedAmount: input.expectedAmount,
        currency: input.currency,
      },
    });

    return intent;
  }

  async confirmCashCollection(input: ConfirmCashCollectionInput): Promise<CashCollectionResult> {
    const expectedIntent = await this.paymentIntentRepository.findByOrderAndMethod(input.orderId, "CASH");
    if (!expectedIntent) {
      throw new PaymentCashExpectationNotFoundError(input.orderId);
    }

    const mismatch = expectedIntent.amount !== input.collectedAmount;
    const capturedAt = new Date().toISOString();
    const capturedIntent: PaymentIntent = {
      ...expectedIntent,
      status: "CAPTURED",
      updatedAt: capturedAt,
    };

    await this.paymentIntentRepository.save(capturedIntent);
    this.eventBus.publish({
      type: "payment.cash_collected.v1",
      occurredAt: capturedAt,
      payload: {
        orderId: input.orderId,
        paymentIntentId: capturedIntent.paymentIntentId,
        expectedAmount: capturedIntent.amount,
        collectedAmount: input.collectedAmount,
        courierId: input.courierId,
        mismatch,
      },
    });
    await this.appendAuditRecord({
      orderId: input.orderId,
      actionType: "PAYMENT_CASH_COLLECTED",
      targetId: capturedIntent.paymentIntentId,
      reasonCode: mismatch ? "CASH_COLLECTION_MISMATCH" : "CASH_COLLECTION_MATCHED",
      timestamp: capturedAt,
      metadata: {
        expectedAmount: capturedIntent.amount,
        collectedAmount: input.collectedAmount,
        courierId: input.courierId,
        mismatch,
      },
    });

    if (mismatch) {
      this.eventBus.publish({
        type: "payment.cash_mismatch_detected.v1",
        occurredAt: capturedAt,
        payload: {
          orderId: input.orderId,
          paymentIntentId: capturedIntent.paymentIntentId,
          expectedAmount: capturedIntent.amount,
          collectedAmount: input.collectedAmount,
          courierId: input.courierId,
        },
      });
      await this.appendAuditRecord({
        orderId: input.orderId,
        actionType: "PAYMENT_CASH_MISMATCH",
        targetId: capturedIntent.paymentIntentId,
        reasonCode: "CASH_MISMATCH_DETECTED",
        timestamp: capturedAt,
        metadata: {
          expectedAmount: capturedIntent.amount,
          collectedAmount: input.collectedAmount,
          courierId: input.courierId,
        },
      });
    }

    return {
      orderId: input.orderId,
      expectedAmount: capturedIntent.amount,
      collectedAmount: input.collectedAmount,
      courierId: input.courierId,
      mismatch,
    };
  }

  async requestRefund(input: RequestRefundInput): Promise<RefundRequest> {
    const paymentIntent = await this.paymentIntentRepository.findById(input.paymentIntentId);
    if (!paymentIntent) {
      throw new PaymentIntentNotFoundError(input.paymentIntentId);
    }

    if (paymentIntent.orderId !== input.orderId || paymentIntent.status !== "CAPTURED") {
      throw new PaymentCapturePreconditionError(input.orderId, paymentIntent.status);
    }

    if (input.amount <= 0 || input.amount > paymentIntent.amount) {
      throw new PaymentRefundAmountInvalidError(input.amount);
    }

    const now = new Date().toISOString();
    const refund: RefundRequest = {
      refundRequestId: randomUUID(),
      orderId: input.orderId,
      paymentIntentId: input.paymentIntentId,
      amount: input.amount,
      reasonCode: input.reasonCode,
      status: "REQUESTED",
      requestedBy: input.requestedBy,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.refundRequestRepository.save(refund);
    await this.appendAuditRecord({
      orderId: refund.orderId,
      actionType: "REFUND_REQUESTED",
      targetId: refund.refundRequestId,
      reasonCode: refund.reasonCode,
      timestamp: now,
      metadata: {
        amount: refund.amount,
        requestedBy: refund.requestedBy,
      },
    });
    return refund;
  }

  async approveRefund(input: ApproveRefundInput): Promise<RefundRequest> {
    const existing = await this.refundRequestRepository.findById(input.refundRequestId);
    if (!existing) {
      throw new PaymentRefundRequestNotFoundError(input.refundRequestId);
    }

    if (existing.status === "COMPLETED") {
      return existing;
    }

    const now = new Date().toISOString();
    const completed: RefundRequest = {
      ...existing,
      status: "COMPLETED",
      approvedBy: input.approvedBy,
      updatedAt: now,
    };

    await this.refundRequestRepository.save(completed);
    this.eventBus.publish({
      type: "refund.completed.v1",
      occurredAt: now,
      payload: {
        refundRequestId: completed.refundRequestId,
        orderId: completed.orderId,
        paymentIntentId: completed.paymentIntentId,
        amount: completed.amount,
        approvedBy: completed.approvedBy,
      },
    });
    await this.appendAuditRecord({
      orderId: completed.orderId,
      actionType: "REFUND_COMPLETED",
      targetId: completed.refundRequestId,
      reasonCode: completed.reasonCode,
      timestamp: now,
      metadata: {
        amount: completed.amount,
        approvedBy: completed.approvedBy,
      },
    });

    return completed;
  }

  async getAuditTrail(orderId: string): Promise<PaymentAuditRecord[]> {
    return this.paymentAuditRepository.listByOrder(orderId);
  }

  private async appendAuditRecord(
    record: Omit<PaymentAuditRecord, "auditEventId">,
  ): Promise<void> {
    const auditRecord: PaymentAuditRecord = {
      auditEventId: randomUUID(),
      ...record,
    };

    await this.paymentAuditRepository.append(auditRecord);
    this.eventBus.publish({
      type: "payment.audit_recorded.v1",
      occurredAt: auditRecord.timestamp,
      payload: {
        auditEventId: auditRecord.auditEventId,
        orderId: auditRecord.orderId,
        actionType: auditRecord.actionType,
        targetId: auditRecord.targetId,
        reasonCode: auditRecord.reasonCode,
      },
    });
  }
}
