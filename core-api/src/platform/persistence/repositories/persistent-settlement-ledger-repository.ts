import { InMemorySettlementLedgerRepository } from "../../../modules/settlement/in-memory-settlement-ledger-repository.js";
import type { SettlementJournalEntry } from "../../../modules/settlement/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "settlement.ledger_entries";

export class PersistentSettlementLedgerRepository extends InMemorySettlementLedgerRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(entry: SettlementJournalEntry): Promise<void> {
    await this.store.put(NAMESPACE, entry.ledgerEntryId, {
      ...entry,
      lines: entry.lines.map((line) => ({ ...line })),
    });
  }
}
