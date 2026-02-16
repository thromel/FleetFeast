import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import type {
  ExecuteSupportInterventionInput,
  SupportInterventionResult,
} from "./types.js";

export interface SupportInterventionDependencies {
  requestCancellation(input: {
    orderId: string;
    reasonCode: string;
  }): Promise<{ status: string }>;
  requestRefund(input: {
    orderId: string;
    paymentIntentId: string;
    amount: number;
    reasonCode: string;
    requestedBy: string;
  }): Promise<{ status: string }>;
}

export class SupportInterventionService {
  constructor(
    private readonly dependencies: SupportInterventionDependencies,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async execute(input: ExecuteSupportInterventionInput): Promise<SupportInterventionResult> {
    if (input.actionType === "CANCEL_ORDER") {
      const order = await this.dependencies.requestCancellation({
        orderId: input.orderId,
        reasonCode: input.reasonCode,
      });

      return this.publishCompleted(input, {
        orderId: input.orderId,
        status: order.status,
      });
    }

    if (input.actionType === "REFUND_PAYMENT") {
      if (!input.paymentIntentId || typeof input.refundAmount !== "number" || input.refundAmount <= 0) {
        throw new Error("INVALID_SUPPORT_INTERVENTION_PAYLOAD");
      }

      const refund = await this.dependencies.requestRefund({
        orderId: input.orderId,
        paymentIntentId: input.paymentIntentId,
        amount: input.refundAmount,
        reasonCode: input.reasonCode,
        requestedBy: input.actorId,
      });

      return this.publishCompleted(input, {
        orderId: input.orderId,
        status: refund.status,
      });
    }

    this.eventBus.publish({
      type: "support.intervention_executed.v1",
      occurredAt: new Date().toISOString(),
      payload: {
        actionType: input.actionType,
        actorId: input.actorId,
        orderId: input.orderId,
        reasonCode: input.reasonCode,
        status: "QUEUED",
      },
    });

    return {
      actionType: input.actionType,
      status: "QUEUED",
      result: {
        orderId: input.orderId,
        reasonCode: input.reasonCode,
      },
    };
  }

  private publishCompleted(
    input: ExecuteSupportInterventionInput,
    result: Record<string, unknown>,
  ): SupportInterventionResult {
    const occurredAt = new Date().toISOString();
    this.eventBus.publish({
      type: "support.intervention_executed.v1",
      occurredAt,
      payload: {
        actionType: input.actionType,
        actorId: input.actorId,
        orderId: input.orderId,
        reasonCode: input.reasonCode,
        status: "COMPLETED",
      },
    });

    return {
      actionType: input.actionType,
      status: "COMPLETED",
      result,
    };
  }
}
