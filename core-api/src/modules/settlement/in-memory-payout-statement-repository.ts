import type { PayoutEntityType, PayoutStatement } from "./types.js";

export class InMemoryPayoutStatementRepository {
  private readonly statements = new Map<string, PayoutStatement>();

  async save(statement: PayoutStatement): Promise<void> {
    this.statements.set(statement.statementId, statement);
  }

  async listByEntity(entityType: PayoutEntityType, entityId: string): Promise<PayoutStatement[]> {
    return [...this.statements.values()]
      .filter((statement) => statement.entityType === entityType && statement.entityId === entityId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
