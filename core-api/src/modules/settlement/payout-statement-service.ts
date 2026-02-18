import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemoryPayoutStatementRepository } from "./in-memory-payout-statement-repository.js";
import type {
  PayoutEntityType,
  PayoutStatement,
  PublishPayoutStatementInput,
} from "./types.js";

export interface PayoutStatementRenderer {
  render(input: PublishPayoutStatementInput): Promise<string>;
}

class DefaultPayoutStatementRenderer implements PayoutStatementRenderer {
  async render(input: PublishPayoutStatementInput): Promise<string> {
    return `s3://payout-statements/${input.payoutBatchId}/${input.entityType.toLowerCase()}-${input.entityId}.pdf`;
  }
}

export class PayoutStatementService {
  constructor(
    private readonly statementRepository: InMemoryPayoutStatementRepository,
    private readonly eventBus: InMemoryEventBus,
    private readonly renderer: PayoutStatementRenderer = new DefaultPayoutStatementRenderer(),
    private readonly renderAttempts: number = 3,
  ) {}

  async publishStatement(input: PublishPayoutStatementInput): Promise<PayoutStatement> {
    let format: PayoutStatement["format"] = "PDF";
    let renderedContent = "";

    for (let attempt = 1; attempt <= this.renderAttempts; attempt += 1) {
      try {
        renderedContent = await this.renderer.render(input);
        break;
      } catch (error) {
        if (attempt === this.renderAttempts) {
          format = "PLAINTEXT";
          renderedContent = this.renderPlainTextFallback(input);
        }
      }
    }

    const createdAt = new Date().toISOString();
    const statement: PayoutStatement = {
      statementId: randomUUID(),
      payoutBatchId: input.payoutBatchId,
      entityType: input.entityType,
      entityId: input.entityId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: input.currency,
      totalAmount: input.totalAmount,
      lineItems: input.lineItems,
      format,
      renderedContent,
      createdAt,
    };

    await this.statementRepository.save(statement);
    this.eventBus.publish({
      type: "payout.statement_published.v1",
      occurredAt: createdAt,
      payload: {
        statementId: statement.statementId,
        payoutBatchId: statement.payoutBatchId,
        entityType: statement.entityType,
        entityId: statement.entityId,
        format: statement.format,
      },
    });

    return statement;
  }

  async listStatements(entityType: PayoutEntityType, entityId: string): Promise<PayoutStatement[]> {
    return this.statementRepository.listByEntity(entityType, entityId);
  }

  private renderPlainTextFallback(input: PublishPayoutStatementInput): string {
    const lines = input.lineItems.map((item) => `${item.label}: ${item.amount}`);
    return [
      `Payout Batch: ${input.payoutBatchId}`,
      `Entity: ${input.entityType}/${input.entityId}`,
      `Period: ${input.periodStart} -> ${input.periodEnd}`,
      ...lines,
      `Total (${input.currency}): ${input.totalAmount}`,
    ].join("\n");
  }
}
