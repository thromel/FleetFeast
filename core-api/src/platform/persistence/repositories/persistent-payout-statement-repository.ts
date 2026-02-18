import { InMemoryPayoutStatementRepository } from "../../../modules/settlement/in-memory-payout-statement-repository.js";
import type { PayoutEntityType, PayoutStatement } from "../../../modules/settlement/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "settlement.payout_statements";

export class PersistentPayoutStatementRepository extends InMemoryPayoutStatementRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(statement: PayoutStatement): Promise<void> {
    await super.save({
      ...statement,
      lineItems: statement.lineItems.map((lineItem) => ({ ...lineItem })),
    });
    await this.store.put(NAMESPACE, statement.statementId, {
      ...statement,
      lineItems: statement.lineItems.map((lineItem) => ({ ...lineItem })),
    });
  }

  override async listByEntity(
    entityType: PayoutEntityType,
    entityId: string,
  ): Promise<PayoutStatement[]> {
    const statements = await this.store.list<PayoutStatement>(NAMESPACE);
    return statements
      .filter((statement) => statement.entityType === entityType && statement.entityId === entityId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((statement) => ({
        ...statement,
        lineItems: statement.lineItems.map((lineItem) => ({ ...lineItem })),
      }));
  }
}
